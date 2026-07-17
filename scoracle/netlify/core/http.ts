import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_RETRIES = 2
const execFileAsync = promisify(execFile)

export function requestIdFrom(event) {
  return (
    event?.headers?.['x-nf-request-id'] ??
    event?.headers?.['X-Nf-Request-Id'] ??
    randomUUID()
  )
}

export async function fetchWithPolicy(
  url,
  options = {},
  { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = {},
) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      if (
        attempt < retries &&
        (response.status === 429 || response.status >= 500)
      ) {
        await response.body?.cancel().catch(() => undefined)
        await delay(150 * 2 ** attempt)
        continue
      }

      return response
    } catch (error) {
      lastError = error

      if (attempt >= retries) {
        throw error
      }

      await delay(150 * 2 ** attempt)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError ?? new Error('Request failed')
}

export async function fetchJson<T = unknown>(url, options = {}): Promise<T> {
  try {
    const response = await fetchWithPolicy(url, options)

    if (!response.ok) {
      const error = Object.assign(
        new Error(`Provider request returned ${response.status}`),
        { code: 'PROVIDER_RESPONSE_ERROR' },
      )
      throw error
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (shouldUseCurlFallback(error, url, options)) {
      return fetchJsonWithCurl<T>(url)
    }

    throw error
  }
}

export function jsonResponse(
  body,
  statusCode = 200,
  cacheControl = 'no-store',
  requestId,
) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
    body: JSON.stringify(body),
  }
}

export function publicError(error, requestId, fallbackCode) {
  logError(error, requestId, fallbackCode)
  return {
    error: fallbackCode,
    requestId,
  }
}

export function logInfo(event, fields = {}) {
  console.info(JSON.stringify({ level: 'info', event, ...fields }))
}

export function logError(error, requestId, code) {
  console.error(
    JSON.stringify({
      level: 'error',
      event: code,
      requestId,
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
  )
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function shouldUseCurlFallback(error, url, options) {
  return (
    process.platform === 'win32' &&
    (!options || Object.keys(options).length === 0) &&
    typeof url === 'string' &&
    url.startsWith('https://footballapi.pulselive.com/') &&
    isSocketAccessError(error)
  )
}

function isSocketAccessError(error) {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : null
  const nestedErrors =
    cause && typeof cause === 'object' && 'errors' in cause
      ? (cause as { errors?: Array<{ code?: string }> }).errors ?? []
      : []

  return (
    (error instanceof Error && error.message === 'fetch failed') &&
    nestedErrors.some((nestedError) => nestedError?.code === 'EACCES')
  )
}

async function fetchJsonWithCurl<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync('curl.exe', ['-sS', url], {
    timeout: DEFAULT_TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  })

  return JSON.parse(stdout) as T
}
