import { jsonResponse, requestIdFrom } from '../core/http.ts'
import {
  getSupabaseServerConfig,
  supabaseHeaders,
} from '../core/supabase.ts'
import type { NetlifyFunctionEvent } from '../core/types.ts'

export async function handler(event: NetlifyFunctionEvent) {
  const requestId = requestIdFrom(event)

  if (event.httpMethod && event.httpMethod !== 'GET') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED', requestId }, 405, 'no-store', requestId)
  }

  const config = getSupabaseServerConfig()

  if (!config) {
    return jsonResponse(
      { status: 'unhealthy', requestId },
      503,
      'no-store',
      requestId,
    )
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/profiles?select=id&limit=1`,
      {
        headers: supabaseHeaders(config),
        signal: AbortSignal.timeout(3_000),
      },
    )

    if (!response.ok) {
      throw new Error('Database health check failed')
    }

    return jsonResponse(
      { status: 'healthy', requestId },
      200,
      'no-store',
      requestId,
    )
  } catch {
    return jsonResponse(
      { status: 'unhealthy', requestId },
      503,
      'no-store',
      requestId,
    )
  }
}
