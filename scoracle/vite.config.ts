import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

type HomeDataFunctionResult = {
  statusCode?: number
  headers?: Record<string, string | number | readonly string[]>
  body?: string
}

type HomeDataFunctionModule = {
  handler: (event: {
    queryStringParameters: Record<string, string>
  }) => Promise<HomeDataFunctionResult>
}

// https://vite.dev/config/
export default defineConfig({
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
            )) as HomeDataFunctionModule
            const url = new URL(request.url ?? '', 'http://localhost')
            const result = await handler({
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
      },
    },
  ],
})
