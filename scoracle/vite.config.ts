import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

type NetlifyFunctionResult = {
  statusCode?: number
  headers?: Record<string, string | number | readonly string[]>
  body?: string
}

type NetlifyFunctionModule = {
  handler: (event: {
    httpMethod?: string
    headers?: Record<string, string>
    body?: string
    queryStringParameters: Record<string, string>
  }) => Promise<NetlifyFunctionResult>
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value
  }

  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(moduleId) {
            if (!moduleId.includes('node_modules')) {
              return undefined
            }

            if (moduleId.includes('@supabase')) {
              return 'supabase'
            }

            if (moduleId.includes('@tanstack')) {
              return 'query'
            }

            if (moduleId.includes('lucide-react')) {
              return 'icons'
            }

            if (
              moduleId.includes('/react/') ||
              moduleId.includes('/react-dom/') ||
              moduleId.includes('/react-router/')
            ) {
              return 'react'
            }

            return 'vendor'
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'scoracle-local-home-data',
        configureServer(server) {
          server.middlewares.use('/api/home-data', async (request, response) => {
            try {
              const functionPath = pathToFileURL(
                resolve(process.cwd(), 'netlify/functions/home-data.ts'),
              ).href
              const { handler } = (await import(
                functionPath
              )) as NetlifyFunctionModule
              const url = new URL(request.url ?? '', 'http://localhost')
              const result = await handler({
                httpMethod: request.method,
                headers: request.headers as Record<string, string>,
                queryStringParameters: Object.fromEntries(url.searchParams),
              })

              for (const [key, value] of Object.entries(result.headers ?? {})) {
                response.setHeader(key, value)
              }

              response.statusCode = result.statusCode ?? 200
              response.end(result.body)
            } catch (error) {
              response.statusCode = 502
              response.setHeader('content-type', 'application/json')
              response.end(
                JSON.stringify({
                  error: 'Unable to load local Scoracle home data',
                  details:
                    error instanceof Error ? error.message : 'Unknown error',
                }),
              )
            }
          })

          server.middlewares.use(
            '/api/cache-oauth-avatar',
            async (request, response) => {
              try {
                const functionPath = pathToFileURL(
                  resolve(
                    process.cwd(),
                    'netlify/functions/cache-oauth-avatar.ts',
                  ),
                ).href
                const { handler } = (await import(
                  functionPath
                )) as NetlifyFunctionModule
                const url = new URL(request.url ?? '', 'http://localhost')
                const body = await readRequestBody(request)
                const result = await handler({
                  httpMethod: request.method,
                  headers: request.headers as Record<string, string>,
                  body,
                  queryStringParameters: Object.fromEntries(url.searchParams),
                })

                for (const [key, value] of Object.entries(result.headers ?? {})) {
                  response.setHeader(key, value)
                }

                response.statusCode = result.statusCode ?? 200
                response.end(result.body)
              } catch (error) {
                response.statusCode = 502
                response.setHeader('content-type', 'application/json')
                response.end(
                  JSON.stringify({
                    error: 'Unable to cache local OAuth avatar',
                    details:
                      error instanceof Error ? error.message : 'Unknown error',
                  }),
                )
              }
            },
          )

          server.middlewares.use(
            '/api/team-details',
            async (request, response) => {
              try {
                const functionPath = pathToFileURL(
                  resolve(process.cwd(), 'netlify/functions/team-details.ts'),
                ).href
                const { handler } = (await import(
                  functionPath
                )) as NetlifyFunctionModule
                const url = new URL(request.url ?? '', 'http://localhost')
                const result = await handler({
                  httpMethod: request.method,
                  headers: request.headers as Record<string, string>,
                  queryStringParameters: Object.fromEntries(url.searchParams),
                })

                for (const [key, value] of Object.entries(result.headers ?? {})) {
                  response.setHeader(key, value)
                }

                response.statusCode = result.statusCode ?? 200
                response.end(result.body)
              } catch (error) {
                response.statusCode = 502
                response.setHeader('content-type', 'application/json')
                response.end(
                  JSON.stringify({
                    error: 'Unable to load local Scoracle team details',
                    details:
                      error instanceof Error ? error.message : 'Unknown error',
                  }),
                )
              }
            },
          )

          server.middlewares.use(
            '/api/admin/user-status',
            async (request, response) => {
              try {
                const functionPath = pathToFileURL(
                  resolve(
                    process.cwd(),
                    'netlify/functions/admin-user-status.ts',
                  ),
                ).href
                const { handler } = (await import(
                  functionPath
                )) as NetlifyFunctionModule
                const result = await handler({
                  httpMethod: request.method,
                  headers: request.headers as Record<string, string>,
                  body: await readRequestBody(request),
                  queryStringParameters: {},
                })

                for (const [key, value] of Object.entries(result.headers ?? {})) {
                  response.setHeader(key, value)
                }

                response.statusCode = result.statusCode ?? 200
                response.end(result.body)
              } catch {
                response.statusCode = 502
                response.setHeader('content-type', 'application/json')
                response.end(JSON.stringify({ error: 'ADMIN_STATUS_UNAVAILABLE' }))
              }
            },
          )

          server.middlewares.use('/api/health', async (request, response) => {
            try {
              const functionPath = pathToFileURL(
                resolve(process.cwd(), 'netlify/functions/health.ts'),
              ).href
              const { handler } = (await import(
                functionPath
              )) as NetlifyFunctionModule
              const result = await handler({
                httpMethod: request.method,
                headers: request.headers as Record<string, string>,
                queryStringParameters: {},
              })

              for (const [key, value] of Object.entries(result.headers ?? {})) {
                response.setHeader(key, value)
              }

              response.statusCode = result.statusCode ?? 200
              response.end(result.body)
            } catch {
              response.statusCode = 503
              response.setHeader('content-type', 'application/json')
              response.end(JSON.stringify({ status: 'unhealthy' }))
            }
          })
        },
      },
    ],
  }
})

async function readRequestBody(request: NodeJS.ReadableStream) {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}
