import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import {
  createThemeOptionsSnapshot,
  LEGACY_DASHBOARD_STORAGE_KEY,
  legacyDashboardOverrides,
  parseSettingKeys,
  parseThemeStorageSnapshot,
  resolveBackgroundSource,
  resolveThemeMode,
  resolveThemeSettings,
  THEME_SETTING_KEYS,
  THEME_SETTINGS_STORAGE_KEY,
  themeStorageSnapshot,
} from '@/theme/settings'
import { STORAGE_KEYS } from '@/services/cfsm/config'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('theme settings schema', () => {
  it('normalizes all 48 audited fields across defaults, backend and local layers', () => {
    expect(THEME_SETTING_KEYS).toHaveLength(48)
    expect(Object.keys(createThemeOptionsSnapshot(resolveThemeSettings({}, {})))).toHaveLength(48)
    const backend = {
      themeMode: 'dark',
      offlineNodesLast: false,
      homeHighLoadThreshold: 72,
      futureOption: { keep: true },
      jwt_token: 'must-not-round-trip',
    }
    const local = {
      offlineNodesLast: true,
      homeHighLoadThreshold: 999,
    }

    const resolved = resolveThemeSettings(backend, local)
    expect(resolved.themeMode).toBe('dark')
    expect(resolved.offlineNodesLast).toBe(true)
    expect(resolved.homeHighLoadThreshold).toBe(72)
    expect(resolved.visitorInfoEnabled).toBe(false)
    expect(resolved.rpcTransportMode).toBe('http')

    const snapshot = createThemeOptionsSnapshot(resolved, backend)
    expect(snapshot.futureOption).toEqual({ keep: true })
    expect(snapshot.jwt_token).toBeUndefined()
    expect(THEME_SETTING_KEYS.every((key) => key in snapshot)).toBe(true)
  })

  it('migrates legacy visual preferences without mixing favorites into theme options', () => {
    expect(legacyDashboardOverrides({
      themeMode: 'system',
      viewMode: 'mini',
      offlineLast: true,
      favoriteKeys: ['source::node'],
    })).toEqual({
      themeMode: 'system',
      defaultViewMode: 'card',
      nodeCardSize: 'mini',
      offlineNodesLast: true,
    })
  })

  it('normalizes key lists, Beijing mode and safe local background paths', () => {
    expect(parseSettingKeys('cpu, memory\ncpu  disk')).toEqual(['cpu', 'memory', 'disk'])
    expect(resolveThemeMode('beijing', false, new Date('2026-01-01T02:00:00Z'))).toBe('light')
    expect(resolveThemeMode('beijing', false, new Date('2026-01-01T14:00:00Z'))).toBe('dark')
    expect(resolveBackgroundSource('local:wallpapers/状态 图.webp')).toBe(
      '/themes/user-assets/wallpapers/%E7%8A%B6%E6%80%81%20%E5%9B%BE.webp',
    )
    expect(resolveBackgroundSource('javascript:alert(1)')).toBe('')
    expect(resolveBackgroundSource('local:../secret')).toBe('')
  })
})

describe('theme settings store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('saves and clears a browser-only override', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_DASHBOARD_STORAGE_KEY, JSON.stringify({
      themeMode: 'light',
      favoriteKeys: ['source::node'],
    }))
    const store = useThemeSettingsStore()

    store.initialize(storage)
    store.hydrateBackend({ themeMode: 'dark', alertTitle: 'Backend' }, 'auto', true)
    expect(store.runtime.themeMode).toBe('light')

    store.draft.alertTitle = 'Local draft'
    expect(store.saveLocal()).toBe(true)
    expect(store.runtime.alertTitle).toBe('Local draft')
    expect(store.hasLocalOverrides).toBe(true)

    const saved = parseThemeStorageSnapshot(storage.getItem(THEME_SETTINGS_STORAGE_KEY))
    expect(saved?.overrides.alertTitle).toBe('Local draft')
    expect(saved?.overrides.favoriteKeys).toBeUndefined()

    store.useBackend()
    expect(store.runtime.themeMode).toBe('dark')
    expect(store.runtime.alertTitle).toBe('Backend')
    expect(store.hasLocalOverrides).toBe(false)
    expect(parseThemeStorageSnapshot(storage.getItem(THEME_SETTINGS_STORAGE_KEY))?.overrides).toEqual({})
  })

  it('posts a complete snapshot, clears local state and rehydrates from /api/config', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.jwt, 'valid-jwt')
    storage.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify(themeStorageSnapshot({
      offlineNodesLast: true,
    })))
    const requests: string[] = []
    let posted: unknown = null
    let authorization = ''
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input)
      requests.push(url)
      if (url.endsWith('/api/theme_options')) {
        posted = JSON.parse(String(init?.body)) as unknown
        authorization = new Headers(init?.headers).get('Authorization') ?? ''
        return new Response(JSON.stringify({
          success: true,
          theme_options: { themeMode: 'dark', futureOption: 'returned' },
          message: 'updateSuccess',
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        authorization: true,
        preferred_theme: 'auto',
        theme_options: { themeMode: 'light', futureOption: 'rehydrated' },
      }), { status: 200 })
    }
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ themeMode: 'system', futureOption: 'original' }, 'auto', true)
    store.draft.themeMode = 'dark'

    const outcome = await store.saveBackend('https://status.example', { storage, fetcher })

    expect(outcome.saved).toBe(true)
    expect(outcome.config?.themeOptions.futureOption).toBe('rehydrated')
    expect(requests).toEqual([
      'https://status.example/api/theme_options',
      'https://status.example/api/config',
    ])
    expect(authorization).toBe('Bearer valid-jwt')
    expect(posted).toHaveProperty('theme_options')
    if (!isRecord(posted)) throw new Error('Expected request body object')
    const themeOptions = posted.theme_options
    expect(typeof themeOptions).toBe('object')
    expect(themeOptions).not.toBeNull()
    expect(Array.isArray(themeOptions)).toBe(false)
    if (!isRecord(themeOptions)) throw new Error('Expected theme_options object')
    expect(THEME_SETTING_KEYS.every((key) => key in themeOptions)).toBe(true)
    expect(themeOptions.futureOption).toBe('original')
    expect(themeOptions.jwt_token).toBeUndefined()
    expect(store.runtime.themeMode).toBe('light')
    expect(store.draft.themeMode).toBe('light')
    expect(store.hasLocalOverrides).toBe(false)
  })

  it('does not attempt a backend write without a Bearer JWT', async () => {
    const storage = new MemoryStorage()
    const store = useThemeSettingsStore()
    let requested = false
    store.initialize(storage)
    store.hydrateBackend({ alertTitle: 'Backend' }, 'auto', true)
    store.draft.alertTitle = 'Retained draft'

    const outcome = await store.saveBackend('https://status.example', {
      storage,
      fetcher: async () => {
        requested = true
        return new Response('{}', { status: 200 })
      },
    })

    expect(requested).toBe(false)
    expect(outcome.saved).toBe(false)
    expect(store.saveError).toMatchObject({ kind: 'unauthorized', code: 'missingJwt' })
    expect(store.draft.alertTitle).toBe('Retained draft')
  })

  it.each([
    { label: '400', response: new Response('{"error":"invalidThemeOptionsFormat"}', { status: 400 }), kind: 'invalid-format' },
    { label: '401', response: new Response('{"message":"unauthorized"}', { status: 401 }), kind: 'unauthorized' },
    { label: '403', response: new Response('{"message":"turnstileFailed"}', { status: 403 }), kind: 'forbidden' },
  ] as const)('retains the draft after a $label backend error', async ({ response, kind }) => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.jwt, 'credential')
    storage.setItem(STORAGE_KEYS.turnstileToken, 'challenge')
    storage.setItem(STORAGE_KEYS.turnstileVerified, 'verified')
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ alertTitle: 'Backend' }, 'auto', true)
    store.draft.alertTitle = 'Unsaved draft'

    const outcome = await store.saveBackend('https://status.example', {
      storage,
      fetcher: async () => response.clone(),
    })

    expect(outcome.saved).toBe(false)
    expect(store.saveError?.kind).toBe(kind)
    expect(store.draft.alertTitle).toBe('Unsaved draft')
    expect(store.runtime.alertTitle).toBe('Unsaved draft')
    if (response.status === 401) expect(storage.getItem(STORAGE_KEYS.jwt)).toBeNull()
    if (response.status === 403) {
      expect(storage.getItem(STORAGE_KEYS.turnstileToken)).toBeNull()
      expect(storage.getItem(STORAGE_KEYS.turnstileVerified)).toBeNull()
    }
  })

  it('retains the draft after a network failure', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.jwt, 'credential')
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ alertTitle: 'Backend' }, 'auto', true)
    store.draft.alertTitle = 'Network draft'

    const outcome = await store.saveBackend('https://status.example', {
      storage,
      fetcher: async () => {
        throw new TypeError('offline')
      },
    })

    expect(outcome.saved).toBe(false)
    expect(store.saveError?.kind).toBe('network')
    expect(store.draft.alertTitle).toBe('Network draft')
  })
})
