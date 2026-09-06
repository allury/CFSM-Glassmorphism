import { apiUrl, readStorage, STORAGE_KEYS, writeStorage } from './config'
import { isRecord } from './adapters'

export interface CfsmRequestOptions {
  base: string
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  fetcher?: typeof fetch
  storage?: Storage
  includeAuth?: boolean
  includeTurnstile?: boolean
}

export class CfsmRequestError extends Error {
  readonly status: number | null
  readonly path: string
  readonly code: string | null
  readonly details: unknown

  constructor(
    message: string,
    options: { status?: number; path: string; code?: string; details?: unknown },
  ) {
    super(message)
    this.name = 'CfsmRequestError'
    this.status = options.status ?? null
    this.path = options.path
    this.code = options.code ?? null
    this.details = options.details
  }
}

function requestHeaders(options: CfsmRequestOptions): Headers {
  const headers = new Headers({ Accept: 'application/json' })
  if (options.method === 'POST') headers.set('Content-Type', 'application/json')

  if (options.includeAuth !== false) {
    const token = readStorage(STORAGE_KEYS.jwt, options.storage)
    if (token) headers.set('Authorization', 'Bearer ' + token)
  }

  if (options.includeTurnstile !== false) {
    const verified = readStorage(STORAGE_KEYS.turnstileVerified, options.storage)
    const token = readStorage(STORAGE_KEYS.turnstileToken, options.storage)
    if (verified) headers.set('X-Turnstile-Verified', verified)
    else if (token) headers.set('X-Turnstile-Token', token)
  }

  return headers
}

async function responseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (text === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function errorDetails(payload: unknown): { message: string; code: string | null } {
  if (!isRecord(payload)) {
    return {
      message: typeof payload === 'string' && payload.trim() ? payload : 'CFSM request failed',
      code: null,
    }
  }
  const message = typeof payload.message === 'string'
    ? payload.message
    : typeof payload.error === 'string'
      ? payload.error
      : 'CFSM request failed'
  const code = typeof payload.code === 'string'
    ? payload.code
    : typeof payload.error === 'string'
      ? payload.error
      : typeof payload.message === 'string'
        ? payload.message
        : null
  return { message, code }
}

export async function cfsmRequest<T = unknown>(
  path: string,
  options: CfsmRequestOptions,
): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 15_000
  const fetcher = options.fetcher ?? fetch
  const abortFromCaller = (): void => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abortFromCaller()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs)
  let response: Response
  try {
    response = await fetcher(apiUrl(options.base, path), {
      method: options.method ?? 'GET',
      headers: requestHeaders(options),
      body: options.method === 'POST' ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (cause) {
    const timedOut = controller.signal.aborted && controller.signal.reason === 'timeout'
    throw new CfsmRequestError(
      timedOut ? 'CFSM request timed out' : 'CFSM request could not be completed',
      { path, code: timedOut ? 'timeout' : 'networkError', details: cause },
    )
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }

  const payload = await responseBody(response)

  if (response.status === 401) writeStorage(STORAGE_KEYS.jwt, null, options.storage)
  if (response.status === 403) {
    writeStorage(STORAGE_KEYS.turnstileToken, null, options.storage)
    writeStorage(STORAGE_KEYS.turnstileVerified, null, options.storage)
  }

  if (!response.ok) {
    const details = errorDetails(payload)
    throw new CfsmRequestError(details.message, {
      status: response.status,
      path,
      code: details.code ?? undefined,
      details: payload,
    })
  }

  if (isRecord(payload) && typeof payload.turnstile_verified === 'string') {
    writeStorage(STORAGE_KEYS.turnstileVerified, payload.turnstile_verified, options.storage)
    writeStorage(STORAGE_KEYS.turnstileToken, null, options.storage)
  }

  return payload as T
}

export function cfsmGet<T = unknown>(
  path: string,
  options: Omit<CfsmRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return cfsmRequest<T>(path, { ...options, method: 'GET' })
}

export function cfsmPost<T = unknown>(
  path: string,
  body: unknown,
  options: Omit<CfsmRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return cfsmRequest<T>(path, { ...options, method: 'POST', body })
}

