import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

loadLocalSupabaseEnv()
applyLocalSupabaseDefaults()

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
}

const parsedUrl = new URL(url)
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
  throw new Error('Refusing to seed a non-local Supabase project.')
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const password = 'Scoracle!123'
const users = [
  { email: 'e2e.user@scoracle.local', username: 'E2EUser', role: 'user', disabled: false },
  { email: 'e2e.disabled@scoracle.local', username: 'E2EDisabled', role: 'user', disabled: true },
  { email: 'e2e.admin@scoracle.local', username: 'E2EAdmin', role: 'admin', disabled: false },
]

const { data: existingData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError

for (const seed of users) {
  let user = existingData.users.find((candidate) => candidate.email === seed.email)
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: seed.email,
      password,
      email_confirm: true,
      user_metadata: {
        username: seed.username,
        first_name: 'E2E',
        last_name: seed.role === 'admin' ? 'Admin' : 'User',
      },
    })
    if (error) throw error
    user = data.user
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: seed.role, is_disabled: seed.disabled, onboarding_required: false })
    .eq('id', user.id)
  if (profileError) throw profileError
}

const { error: deleteJobRunError } = await supabase
  .from('system_job_runs')
  .delete()
  .eq('job_name', 'github-daily-maintenance')
if (deleteJobRunError) throw deleteJobRunError

const { error: jobRunError } = await supabase.from('system_job_runs').insert({
  job_name: 'github-daily-maintenance',
  status: 'success',
  details: { source: 'local-e2e-seed' },
})
if (jobRunError) throw jobRunError

console.log('Seeded local E2E users.')

function loadLocalSupabaseEnv() {
  const envPath = resolve(process.cwd(), '.env.localhost.local')

  if (!existsSync(envPath)) {
    return
  }

  const envContents = readFileSync(envPath, 'utf8')

  for (const line of envContents.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmedLine.indexOf('=')

    if (separatorIndex < 0) {
      continue
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim()

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function applyLocalSupabaseDefaults() {
  process.env.SUPABASE_URL ||= process.env.VITE_SUPABASE_URL

  if (process.env.SUPABASE_SERVICE_ROLE_KEY || !isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
    return
  }

  const jwtSecret =
    process.env.SUPABASE_JWT_SECRET ??
    'super-secret-jwt-token-with-at-least-32-characters-long'
  process.env.SUPABASE_SERVICE_ROLE_KEY = createServiceRoleJwt(jwtSecret)
}

function isLocalSupabaseUrl(rawUrl) {
  if (!rawUrl) {
    return false
  }

  try {
    const parsedUrl = new URL(rawUrl)
    return ['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)
  } catch {
    return false
  }
}

function createServiceRoleJwt(secret) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({
    iss: 'supabase-demo',
    role: 'service_role',
    exp: 1983812996,
  }))
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url')
}
