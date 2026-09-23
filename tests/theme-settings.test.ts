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

  /*
   * 顶栏的明暗按钮。此前它在四个主题模式之间轮换（北京时间自动 → 跟随系统 → 浅色 →
   * 深色）：白天前三种看起来都是浅色，手机上要连点三下画面才变暗。现在只有三种状态，
   * 并且第一下一定切到与当前显示相反的那一种，每次点击都看得见变化。
   */
  it('明暗按钮第一下就切到相反的明暗，第三下回到跟随站点设置', () => {
    const storage = new MemoryStorage()
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ themeMode: 'light' }, 'auto', true)
    expect(store.themeOverride).toBeNull()
    expect(store.resolvedTheme).toBe('light')

    store.cycleTheme()
    expect(store.themeOverride).toBe('dark')
    expect(store.resolvedTheme).toBe('dark')

    store.cycleTheme()
    expect(store.themeOverride).toBe('light')
    expect(store.resolvedTheme).toBe('light')

    store.cycleTheme()
    expect(store.themeOverride).toBeNull()
    expect(store.siteThemeMode).toBe('light')
    expect(parseThemeStorageSnapshot(storage.getItem(THEME_SETTINGS_STORAGE_KEY))?.overrides.themeMode).toBeUndefined()
  })

  it('站点本来就是深色时，第一下切到浅色', () => {
    const store = useThemeSettingsStore()
    store.initialize(new MemoryStorage())
    store.hydrateBackend({ themeMode: 'dark' }, 'auto', true)
    expect(store.resolvedTheme).toBe('dark')

    store.cycleTheme()
    expect(store.themeOverride).toBe('light')
    expect(store.resolvedTheme).toBe('light')

    store.cycleTheme()
    expect(store.themeOverride).toBe('dark')
    store.cycleTheme()
    expect(store.themeOverride).toBeNull()
  })

  it('本地存着旧的自动模式覆盖时，也是一下就切到相反的明暗', () => {
    const storage = new MemoryStorage()
    storage.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify(themeStorageSnapshot({ themeMode: 'beijing' })))
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ themeMode: 'light' }, 'auto', true)
    /*
     * 覆盖值不是浅色也不是深色，按「跟随」处理：下一步给出与**站点设置**相反的明暗。
     * 这里的站点设置是浅色，所以结果固定是深色——不能拿带覆盖的当前呈现去推，
     * 那样在北京时间夜间跑这条用例会翻过来。
     */
    expect(store.themeOverride).toBeNull()
    expect(store.siteThemeMode).toBe('light')
    store.cycleTheme()
    expect(store.themeOverride).toBe('dark')
    expect(store.resolvedTheme).toBe('dark')
  })

  it('回到跟随站点设置只清除主题这一项，其它本地覆盖保留', () => {
    const storage = new MemoryStorage()
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ themeMode: 'light', alertTitle: 'Backend' }, 'auto', true)
    store.setLocalSetting('alertTitle', 'Local')

    store.cycleTheme()
    store.cycleTheme()
    store.cycleTheme()

    expect(store.themeOverride).toBeNull()
    expect(store.runtime.alertTitle).toBe('Local')
    expect(store.hasLocalOverrides).toBe(true)
    expect(parseThemeStorageSnapshot(storage.getItem(THEME_SETTINGS_STORAGE_KEY))?.overrides.alertTitle).toBe('Local')
  })

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

  it('coalesces rapid save clicks into one backend write and one config readback', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.jwt, 'credential')
    let releaseWrite: (() => void) | undefined
    let writes = 0
    let reads = 0
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/api/theme_options')) {
        writes += 1
        await new Promise<void>((resolve) => {
          releaseWrite = resolve
        })
        return new Response(JSON.stringify({
          success: true,
          theme_options: { themeMode: 'dark' },
        }), { status: 200 })
      }
      reads += 1
      return new Response(JSON.stringify({
        authorization: true,
        theme_options: { themeMode: 'dark' },
      }), { status: 200 })
    }
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ themeMode: 'light' }, 'auto', true)
    store.draft.themeMode = 'dark'

    const first = store.saveBackend('https://status.example', { storage, fetcher })
    const second = store.saveBackend('https://status.example', { storage, fetcher })
    expect(writes).toBe(1)
    releaseWrite?.()
    const outcomes = await Promise.all([first, second])

    expect(outcomes.every((outcome) => outcome.saved)).toBe(true)
    expect(writes).toBe(1)
    expect(reads).toBe(1)
    expect(store.runtime.themeMode).toBe('dark')
  })

  it('rejects a changed second submission explicitly and retains its draft for retry', async () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.jwt, 'credential')
    let releaseWrite: (() => void) | undefined
    const writes: unknown[] = []
    const fetcher: typeof fetch = async (input, init) => {
      if (String(input).endsWith('/api/theme_options')) {
        writes.push(JSON.parse(String(init?.body)) as unknown)
        await new Promise<void>((resolve) => { releaseWrite = resolve })
        return new Response(JSON.stringify({ success: true, theme_options: { alertTitle: 'First' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ authorization: true, theme_options: { alertTitle: 'First' } }), { status: 200 })
    }
    const store = useThemeSettingsStore()
    store.initialize(storage)
    store.hydrateBackend({ alertTitle: 'Original' }, 'auto', true)
    store.draft.alertTitle = 'First'

    const first = store.saveBackend('https://status.example', { storage, fetcher })
    store.draft.alertTitle = 'Second'
    const second = await store.saveBackend('https://status.example', { storage, fetcher })
    expect(second.saved).toBe(false)
    expect(store.saveError?.message).toContain('上一次保存尚未完成')
    releaseWrite?.()
    expect((await first).saved).toBe(true)
    expect(writes).toHaveLength(1)
    expect(store.draft.alertTitle).toBe('Second')
    expect(store.hasDraftChanges).toBe(true)

    const retry = await store.saveBackend('https://status.example', { storage, fetcher: async (input, init) => {
      if (String(input).endsWith('/api/theme_options')) {
        writes.push(JSON.parse(String(init?.body)) as unknown)
        return new Response(JSON.stringify({ success: true, theme_options: { alertTitle: 'Second' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ authorization: true, theme_options: { alertTitle: 'Second' } }), { status: 200 })
    } })
    expect(retry.saved).toBe(true)
    expect(writes).toHaveLength(2)
    expect(JSON.stringify(writes[1])).toContain('"alertTitle":"Second"')
    expect(store.draft.alertTitle).toBe('Second')
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

/*
 * 「数据更新间隔」的取值范围。
 *
 * 运行时一直把低于 5 秒的值按 5 秒执行（`MIN_FALLBACK_INTERVAL_MS`），但 schema 此前
 * 允许 1–60，界面也让人填 2——填进去的数字和实际执行的不是一回事。现在两边统一到 5–60：
 * 低于下限的旧值在读取时归一到默认值，页面显示的就是真正会执行的间隔。
 */
describe('data update interval bounds', () => {
  it('rejects a stored value below the runtime floor', () => {
    const resolved = resolveThemeSettings({ dataUpdateInterval: 2 }, {})
    expect(resolved.dataUpdateInterval).toBe(5)
  })

  it('keeps values inside the supported range', () => {
    expect(resolveThemeSettings({ dataUpdateInterval: 5 }, {}).dataUpdateInterval).toBe(5)
    expect(resolveThemeSettings({ dataUpdateInterval: 30 }, {}).dataUpdateInterval).toBe(30)
    expect(resolveThemeSettings({ dataUpdateInterval: 60 }, {}).dataUpdateInterval).toBe(60)
    expect(resolveThemeSettings({ dataUpdateInterval: 61 }, {}).dataUpdateInterval).toBe(5)
  })

  it('defaults to the floor rather than a value that can never run', () => {
    expect(resolveThemeSettings({}, {}).dataUpdateInterval).toBe(5)
  })
})
