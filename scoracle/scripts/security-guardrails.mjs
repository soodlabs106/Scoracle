import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(packageRoot, '..')
const allowedTextExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.sql',
  '.toml',
  '.yml',
  '.yaml',
  '.sh',
  '.ps1',
  '.txt',
])
const codeExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
])
const ignoredDirectories = new Set([
  '.git',
  '.vite',
  'node_modules',
  'dist',
  'coverage',
  '.netlify',
])
const forbiddenSinkPatterns = [
  /dangerouslySetInnerHTML/,
  /\binnerHTML\s*=/,
  /\beval\s*\(/,
  /\bnew Function\s*\(/,
  /\bdocument\.write\s*\(/,
]
const secretLiteralPatterns = [
  /\bSUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"`]?(?:eyJ|sb_secret_)/,
  /\bSERVICE_ROLE_KEY\s*[:=]\s*['"`]?(?:eyJ|sb_secret_)/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
]
const allowedServiceRoleFiles = new Set([
  'scoracle/netlify/core/supabase.ts',
  'scoracle/netlify/functions/home-data.ts',
  'scoracle/netlify/functions/team-details.ts',
])
const serviceRoleReference = 'SUPABASE_SERVICE_ROLE_KEY'

const failures = []
const files = collectFiles(repoRoot)

for (const file of files) {
  const relativePath = relative(repoRoot, file).replaceAll('\\', '/')
  const content = readFileSync(file, 'utf8')
  const extension = extname(file)

  if (
    codeExtensions.has(extension) &&
    relativePath !== 'scoracle/scripts/security-guardrails.mjs'
  ) {
    for (const pattern of forbiddenSinkPatterns) {
      if (pattern.test(content)) {
        failures.push(
          `${relativePath}: forbidden client-side HTML/script sink matched ${pattern}`,
        )
      }
    }
  }

  for (const pattern of secretLiteralPatterns) {
    if (pattern.test(content)) {
      failures.push(
        `${relativePath}: possible committed secret literal matched ${pattern}`,
      )
    }
  }

  if (
    relativePath.startsWith('scoracle/netlify/') &&
    content.includes(serviceRoleReference) &&
    !allowedServiceRoleFiles.has(relativePath) &&
    !relativePath.includes('/tests/')
  ) {
    failures.push(
      `${relativePath}: new service-role endpoint or helper detected; explicit auth review required`,
    )
  }
}

assertStrictCsp(
  join(packageRoot, 'netlify.toml'),
  readFileSync(join(packageRoot, 'netlify.toml'), 'utf8'),
)
assertStrictCsp(
  join(packageRoot, 'public', '_headers'),
  readFileSync(join(packageRoot, 'public', '_headers'), 'utf8'),
)
assertApiRedirectHardening(
  join(packageRoot, 'netlify.toml'),
  readFileSync(join(packageRoot, 'netlify.toml'), 'utf8'),
)
assertApiRedirectHardening(
  join(packageRoot, 'public', '_redirects'),
  readFileSync(join(packageRoot, 'public', '_redirects'), 'utf8'),
)

if (failures.length > 0) {
  console.error('Security guardrails failed:\n')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Security guardrails passed.')

function collectFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true })
  const results = []

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue
    }

    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath))
      continue
    }

    if (!allowedTextExtensions.has(extname(entry.name))) {
      continue
    }

    if (!statSync(fullPath).isFile()) {
      continue
    }

    results.push(fullPath)
  }

  return results
}

function assertStrictCsp(filePath, content) {
  const relativePath = relative(repoRoot, filePath).replaceAll('\\', '/')

  if (!content.includes("object-src 'none'")) {
    failures.push(`${relativePath}: CSP must include object-src 'none'`)
  }

  if (!content.includes("frame-ancestors 'none'")) {
    failures.push(`${relativePath}: CSP must include frame-ancestors 'none'`)
  }

  if (content.includes("'unsafe-eval'")) {
    failures.push(`${relativePath}: CSP must not allow 'unsafe-eval'`)
  }

  if (/script-src[^"\n]*https:\/\/\*/.test(content)) {
    failures.push(`${relativePath}: CSP script-src must not use wildcard external domains`)
  }

  if (/img-src[^"\n]*https:\/\/\*/.test(content)) {
    failures.push(`${relativePath}: CSP img-src must not use wildcard external domains`)
  }
}

function assertApiRedirectHardening(filePath, content) {
  const relativePath = relative(repoRoot, filePath).replaceAll('\\', '/')
  const requiredApiRoutes = [
    '/api/home-data',
    '/api/team-details',
    '/api/cache-oauth-avatar',
    '/api/admin/user-status',
    '/api/health',
  ]

  for (const route of requiredApiRoutes) {
    if (!content.includes(route)) {
      failures.push(`${relativePath}: missing redirect rule for ${route}`)
    }
  }

  if (relativePath.endsWith('netlify.toml') && !/force\s*=\s*true/.test(content)) {
    failures.push(`${relativePath}: API redirects must be force=true`)
  }

  if (relativePath.endsWith('_redirects') && !/200!/.test(content)) {
    failures.push(`${relativePath}: API redirects must use forced 200! rules`)
  }
}
