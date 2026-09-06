import { describe, expect, it } from 'vitest'
import {
  CfsmRequestError,
  cfsmGet,
  cfsmPost,
} from '@/services/cfsm/http'
import { STORAGE_KEYS } from '@/services/cfsm/config'
import { saveThemeOptions } from '@/services/cfsm/api'

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value))
  }
}

describe('CFSM HTTP transport', () => {
  it('sends JWT and the reusable Turnstile credential', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.jwt, 'jwt-value')
    storage.setItem(STORAGE_KEYS.turnstileToken, 'one-use-value')
    storage.setItem(STORAGE_KEYS.turnstileVerified, 'verified-value')

    let receivedUrl = ''
    let receivedInit: RequestInit | undefined
    const fetcher: typeof fetch = async (input, init) => {
      receivedUrl = String(input)
      receivedInit = init
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await cfsmGet('/api/config', {
      base: 'https://status.example',
      storage,
      fetcher,
    })

    const headers = new Headers(receivedInit?.headers)
    expect(receivedUrl).toBe('https://status.example/api/config')
    expect(receivedInit?.credentials).toBe('include')
    expect(headers.get('Authorization')).toBe('Bearer jwt-value')
    expect(headers.get('X-Turnstile-Verified')).toBe('verified-value')
    expect(headers.has('X-Turnstile-Token')).toBe(false)
  })

  it('stores a returned verification credential and consumes the one-use token', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.turnstileToken, 'one-use-value')
    const fetcher: typeof fetch = async () => new Response(
      '{"verified":true,"turnstile_verified":"cached-value"}',
      { status: 200 },
    )

    await cfsmGet('/api/config', {
      base: 'https://status.example',
      storage,
      fetcher,
    })

    expect(storage.getItem(STORAGE_KEYS.turnstileVerified)).toBe('cached-value')
    expect(storage.getItem(STORAGE_KEYS.turnstileToken)).toBeNull()
  })

  it('clears invalid credentials and surfaces API status and code', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.jwt, 'expired')
    const fetcher: typeof fetch = async () => new Response(
      '{"message":"databaseUpgradeRequired"}',
      { status: 401 },
    )

    await expect(cfsmGet('/api/history/all?id=x&hours=48', {
      base: 'https://status.example',
      storage,
      fetcher,
    })).rejects.toMatchObject({
      status: 401,
      code: 'databaseUpgradeRequired',
    })
    expect(storage.getItem(STORAGE_KEYS.jwt)).toBeNull()
  })

  it('posts the complete theme-options object to the only public theme write API', async () => {
    let receivedBody: string | undefined
    const fetcher: typeof fetch = async (_input, init) => {
      receivedBody = typeof init?.body === 'string' ? init.body : undefined
      return new Response(
        '{"success":true,"theme_options":{"themeMode":"dark","backgroundEnabled":true},"message":"updateSuccess"}',
        { status: 200 },
      )
    }

    const result = await saveThemeOptions({
      themeMode: 'dark',
      backgroundEnabled: true,
    }, 'https://status.example', { fetcher })

    expect(JSON.parse(receivedBody ?? '{}')).toEqual({
      theme_options: {
        themeMode: 'dark',
        backgroundEnabled: true,
      },
    })
    expect(result.success).toBe(true)
    expect(result.themeOptions).toEqual({
      themeMode: 'dark',
      backgroundEnabled: true,
    })
  })

  it('wraps structured failure responses without redirecting', async () => {
    const fetcher: typeof fetch = async () => new Response(
      '{"error":"invalidThemeOptionsFormat"}',
      { status: 400 },
    )

    try {
      await cfsmPost('/api/theme_options', { theme_options: null }, {
        base: 'https://status.example',
        fetcher,
      })
      throw new Error('Expected request failure')
    } catch (error) {
      expect(error).toBeInstanceOf(CfsmRequestError)
      expect(error).toMatchObject({
        status: 400,
        code: 'invalidThemeOptionsFormat',
        path: '/api/theme_options',
      })
    }
  })
})

