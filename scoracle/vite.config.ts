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
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'scoracle-local-home-data',
        configureServer(server) {
          server.middlewares.use('/api/home-data', async (request, response) => {
            try {
              const functionPath = pathToFileURL(
                resolve(process.cwd(), 'netlify/functions/home-data.mjs'),
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
                    'netlify/functions/cache-oauth-avatar.mjs',
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
