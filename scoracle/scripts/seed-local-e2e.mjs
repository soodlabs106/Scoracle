import { createClient } from '@supabase/supabase-js'

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

console.log('Seeded local E2E users.')
