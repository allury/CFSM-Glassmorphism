import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { SiteConfig } from '@/types/cfsm'
import type { DashboardViewMode } from '@/types/glassmorphism'
import {
  CfsmRequestError,
  fetchSiteConfig,
  saveThemeOptions,
  STORAGE_KEYS,
} from '@/services/cfsm'
import {
  cloneThemeSettings,
  createThemeOptionsSnapshot,
  dashboardViewMode,
  dashboardViewPatch,
  DEFAULT_THEME_SETTINGS,
  LEGACY_DASHBOARD_STORAGE_KEY,
  legacyDashboardOverrides,
  normalizeThemeSettingsLayer,
  parseGlassCustomColors,
  parseThemeStorageSnapshot,
  resolveThemeMode,
  resolveThemeSettings,
  serializeThemeSettings,
  THEME_SETTINGS_STORAGE_KEY,
  themeSettingsEqual,
  themeStorageSnapshot,
  validateThemeSettingsDraft,
  type GlassColorPreset,
  type GlassCustomColors,
  type ThemeDraftIssue,
  type ThemeMode,
  type ThemeSettings,
} from '@/theme/settings'

export type ThemeSaveState = 'idle' | 'saving' | 'success' | 'error'
export type ThemeSaveErrorKind = 'invalid-format' | 'unauthorized' | 'forbidden' | 'network' | 'unknown'

export interface ThemeSaveFailure {
  kind: ThemeSaveErrorKind
  status: number | null
  code: string | null
  message: string
}

export interface ThemeSaveOptions {
  fetcher?: typeof fetch
  storage?: Storage
  timeoutMs?: number
}

export interface ThemeSaveOutcome {
  saved: boolean
  config: SiteConfig | null
  refetchWarning: string | null
}

const PRESET_COLORS: Record<Exclude<GlassColorPreset, '自定义'>, GlassCustomColors> = {
  翡翠: {
    lightCard: '#f6f9fcb8',
    lightControl: '#eaf1f89e',
    lightText: '#101722',
    lightMutedText: '#536274',
    lightBorder: '#ffffffbd',
    darkCard: '#0b111bc2',
    darkControl: '#121b29a3',
    darkText: '#f2f6fb',
    darkMutedText: '#b6c2d0',
    darkBorder: '#ffffff21',
  },
  柔和: {
    lightCard: '#f8f5f2c7',
    lightControl: '#eee8e3ad',
    lightText: '#24201f',
    lightMutedText: '#6d625e',
    lightBorder: '#ffffffc9',
    darkCard: '#171416d9',
    darkControl: '#211d21c2',
    darkText: '#fbf6f1',
    darkMutedText: '#cabfba',
    darkBorder: '#ffffff24',
  },
  高对比: {
    lightCard: '#fffffff2',
    lightControl: '#edf1f5f2',
    lightText: '#05070a',
    lightMutedText: '#303945',
    lightBorder: '#70809070',
    darkCard: '#05070af2',
    darkControl: '#111722f2',
    darkText: '#ffffff',
    darkMutedText: '#dce5ef',
    darkBorder: '#ffffff52',
  },
  午夜: {
    lightCard: '#e9eef8d9',
    lightControl: '#dce5f4cc',
    lightText: '#11182a',
    lightMutedText: '#485675',
    lightBorder: '#ffffffbd',
    darkCard: '#080b18e6',
    darkControl: '#0f1529d9',
    darkText: '#f0f3ff',
    darkMutedText: '#abb7d8',
    darkBorder: '#9cb6ff33',
  },
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...value }
    : {}
}

function storageTarget(storage?: Storage): Storage | null {
  if (storage) return storage
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readStoredValue(key: string, storage?: Storage): string | null {
  try {
    return storageTarget(storage)?.getItem(key) ?? null
  } catch {
    return null
  }
}

function hasStoredJwt(storage?: Storage): boolean {
  const value = readStoredValue(STORAGE_KEYS.jwt, storage)
  return value !== null && value.trim().length > 0
}

function writeStoredOverrides(overrides: Record<string, unknown>, storage?: Storage): boolean {
  try {
    const target = storageTarget(storage)
    if (!target) return false
    target.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify(themeStorageSnapshot(overrides)))
    return true
  } catch {
    return false
  }
}

function readInitialOverrides(storage?: Storage): Record<string, unknown> {
  const stored = parseThemeStorageSnapshot(readStoredValue(THEME_SETTINGS_STORAGE_KEY, storage))
  if (stored) return stored.overrides

  const legacyRaw = readStoredValue(LEGACY_DASHBOARD_STORAGE_KEY, storage)
  let legacy: unknown = null
  if (legacyRaw) {
    try {
      legacy = JSON.parse(legacyRaw) as unknown
    } catch {
      legacy = null
    }
  }
  const migrated = legacyDashboardOverrides(legacy)
  writeStoredOverrides(migrated, storage)
  return migrated
}

function saveFailure(error: unknown): ThemeSaveFailure {
  if (error instanceof CfsmRequestError) {
    const kind: ThemeSaveErrorKind = error.status === 400
      ? 'invalid-format'
      : error.status === 401
        ? 'unauthorized'
        : error.status === 403
          ? 'forbidden'
          : error.status === null && (error.code === 'networkError' || error.code === 'timeout')
            ? 'network'
            : 'unknown'
    return {
      kind,
      status: error.status,
      code: error.code,
      message: error.message,
    }
  }
  return {
    kind: 'unknown',
    status: null,
    code: null,
    message: error instanceof Error ? error.message : 'Unknown theme settings error',
  }
}

function activeColors(settings: ThemeSettings): GlassCustomColors {
  if (settings.glassColorPreset === '自定义') {
    return parseGlassCustomColors(settings.glassCustomColors) ?? PRESET_COLORS.翡翠
  }
  return PRESET_COLORS[settings.glassColorPreset]
}

export const useThemeSettingsStore = defineStore('theme-settings', () => {
  const initialized = ref(false)
  const backendRaw = ref<Record<string, unknown>>({})
  const localOverrides = ref<Record<string, unknown>>({})
  const preferredTheme = ref<'auto' | 'light' | 'dark'>('auto')
  const persisted = ref<ThemeSettings>(cloneThemeSettings(DEFAULT_THEME_SETTINGS))
  const runtime = ref<ThemeSettings>(cloneThemeSettings(DEFAULT_THEME_SETTINGS))
  const draft = ref<ThemeSettings>(cloneThemeSettings(DEFAULT_THEME_SETTINGS))
  const previewing = ref(false)
  const draftIssues = ref<ThemeDraftIssue[]>([])
  const saveState = ref<ThemeSaveState>('idle')
  const saveError = ref<ThemeSaveFailure | null>(null)
  const message = ref<string | null>(null)
  const refetchWarning = ref<string | null>(null)
  const systemDark = ref(false)
  const hasBackendCredential = ref(false)
  const clock = ref(Date.now())
  let activeStorage: Storage | undefined
  let mediaQuery: MediaQueryList | null = null
  let storageListenerInstalled = false

  const resolvedTheme = computed(() => resolveThemeMode(
    runtime.value.themeMode,
    systemDark.value,
    new Date(clock.value),
  ))
  const viewMode = computed(() => dashboardViewMode(runtime.value))
  const localOverrideCount = computed(() => Object.keys(localOverrides.value).length)
  const hasLocalOverrides = computed(() => localOverrideCount.value > 0)
  const hasDraftChanges = computed(() => !themeSettingsEqual(draft.value, persisted.value))
  const canSaveDraft = computed(() => draftIssues.value.length === 0 && saveState.value !== 'saving')
  const draftSnapshot = computed(() => createThemeOptionsSnapshot(
    normalizeThemeSettingsLayer(draft.value, persisted.value),
    backendRaw.value,
  ))

  function applyRuntime(): void {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const colors = activeColors(runtime.value)
    const dark = resolvedTheme.value === 'dark'
    const card = dark ? colors.darkCard : colors.lightCard
    const control = dark ? colors.darkControl : colors.lightControl
    const text = dark ? colors.darkText : colors.lightText
    const muted = dark ? colors.darkMutedText : colors.lightMutedText
    const border = dark ? colors.darkBorder : colors.lightBorder

    root.dataset.theme = resolvedTheme.value
    root.dataset.colorVision = runtime.value.colorVisionMode === '色觉友好' ? 'friendly' : 'standard'
    root.dataset.motion = runtime.value.disablePageAnimation ? 'reduced' : 'full'
    root.style.colorScheme = resolvedTheme.value
    root.style.setProperty('--glass', card)
    root.style.setProperty('--glass-strong', card)
    root.style.setProperty('--glass-soft', control)
    root.style.setProperty('--glass-hover', control)
    root.style.setProperty('--glass-border', border)
    root.style.setProperty('--ink', text)
    root.style.setProperty('--muted', muted)
  }

  function rebuildFromLayers(reseedDraft = false): void {
    persisted.value = resolveThemeSettings(
      backendRaw.value,
      localOverrides.value,
      preferredTheme.value,
    )
    if (reseedDraft || !previewing.value) {
      runtime.value = cloneThemeSettings(persisted.value)
      draft.value = cloneThemeSettings(persisted.value)
      draftIssues.value = []
      previewing.value = false
    }
  }

  function onMediaChange(event: MediaQueryListEvent): void {
    systemDark.value = event.matches
  }

  function initialize(storage?: Storage): void {
    if (initialized.value) return
    activeStorage = storage
    hasBackendCredential.value = hasStoredJwt(storage)
    localOverrides.value = readInitialOverrides(storage)
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      systemDark.value = mediaQuery.matches
      mediaQuery.addEventListener('change', onMediaChange)
    }
    if (typeof window !== 'undefined') {
      setInterval(() => {
        clock.value = Date.now()
      }, 60_000)
      if (!storageListenerInstalled) {
        window.addEventListener('storage', (event) => {
          if (event.key === STORAGE_KEYS.jwt) {
            hasBackendCredential.value = typeof event.newValue === 'string' && event.newValue.trim().length > 0
            return
          }
          if (event.key !== THEME_SETTINGS_STORAGE_KEY) return
          localOverrides.value = parseThemeStorageSnapshot(event.newValue)?.overrides ?? {}
          rebuildFromLayers(true)
        })
        storageListenerInstalled = true
      }
    }
    initialized.value = true
    rebuildFromLayers(true)
    applyRuntime()
  }

  function hydrateBackend(
    options: unknown,
    sitePreferredTheme: 'auto' | 'light' | 'dark' = 'auto',
    forceReseed = false,
  ): void {
    backendRaw.value = recordValue(options)
    preferredTheme.value = sitePreferredTheme
    hasBackendCredential.value = hasStoredJwt(activeStorage)
    rebuildFromLayers(forceReseed)
  }

  function previewDraft(): void {
    const changed = !themeSettingsEqual(draft.value, persisted.value)
    draftIssues.value = validateThemeSettingsDraft(draft.value)
    runtime.value = normalizeThemeSettingsLayer(draft.value, persisted.value)
    previewing.value = changed
    if (changed) {
      message.value = null
      saveError.value = null
    }
  }

  function resetDraft(): void {
    draft.value = cloneThemeSettings(persisted.value)
    runtime.value = cloneThemeSettings(persisted.value)
    draftIssues.value = []
    previewing.value = false
    message.value = '已放弃未保存预览。'
    saveError.value = null
  }

  function persistOverrides(): boolean {
    return writeStoredOverrides(localOverrides.value, activeStorage)
  }

  function setLocalSetting<Key extends keyof ThemeSettings>(
    key: Key,
    value: ThemeSettings[Key],
  ): void {
    localOverrides.value = { ...localOverrides.value, [key]: value }
    persistOverrides()
    previewing.value = false
    rebuildFromLayers(true)
  }

  function setDashboardViewMode(nextViewMode: DashboardViewMode): void {
    localOverrides.value = {
      ...localOverrides.value,
      ...dashboardViewPatch(nextViewMode),
    }
    persistOverrides()
    previewing.value = false
    rebuildFromLayers(true)
  }

  function cycleTheme(): void {
    const modes: ThemeMode[] = ['beijing', 'system', 'light', 'dark']
    const current = modes.indexOf(runtime.value.themeMode)
    setLocalSetting('themeMode', modes[(current + 1) % modes.length] ?? 'beijing')
  }

  function saveLocal(): boolean {
    previewDraft()
    if (draftIssues.value.length > 0) {
      saveState.value = 'error'
      message.value = null
      return false
    }
    const normalized = normalizeThemeSettingsLayer(draft.value, persisted.value)
    localOverrides.value = serializeThemeSettings(normalized)
    const stored = persistOverrides()
    previewing.value = false
    rebuildFromLayers(true)
    saveState.value = 'success'
    saveError.value = null
    refetchWarning.value = null
    message.value = stored
      ? '设置已保存为此浏览器的本地覆盖。'
      : '浏览器拒绝写入存储；设置仅在当前页面会话中生效。'
    return stored
  }

  function useBackend(): void {
    localOverrides.value = {}
    const stored = persistOverrides()
    previewing.value = false
    rebuildFromLayers(true)
    saveState.value = 'success'
    saveError.value = null
    refetchWarning.value = null
    message.value = stored
      ? '已清除本地覆盖，当前使用 CFSM 后端配置。'
      : '当前会话已使用后端配置，但浏览器拒绝更新本地存储；重新加载后旧覆盖可能恢复。'
  }

  async function saveBackend(base: string, options: ThemeSaveOptions = {}): Promise<ThemeSaveOutcome> {
    previewDraft()
    if (draftIssues.value.length > 0) {
      saveState.value = 'error'
      return { saved: false, config: null, refetchWarning: null }
    }

    const normalized = normalizeThemeSettingsLayer(draft.value, persisted.value)
    const snapshot = createThemeOptionsSnapshot(normalized, backendRaw.value)
    const requestStorage = options.storage ?? activeStorage
    hasBackendCredential.value = hasStoredJwt(requestStorage)
    if (!hasBackendCredential.value) {
      saveState.value = 'error'
      saveError.value = {
        kind: 'unauthorized',
        status: 401,
        code: 'missingJwt',
        message: 'A Bearer JWT is required to save CFSM theme options',
      }
      return { saved: false, config: null, refetchWarning: null }
    }
    saveState.value = 'saving'
    saveError.value = null
    message.value = null
    refetchWarning.value = null

    let result
    try {
      result = await saveThemeOptions(snapshot, base, {
        fetcher: options.fetcher,
        storage: requestStorage,
        timeoutMs: options.timeoutMs,
      })
      if (!result.success) throw new Error(result.message ?? 'CFSM did not confirm the theme settings update')
    } catch (error) {
      saveState.value = 'error'
      saveError.value = saveFailure(error)
      hasBackendCredential.value = hasStoredJwt(requestStorage)
      return { saved: false, config: null, refetchWarning: null }
    }

    backendRaw.value = recordValue(result.themeOptions)
    localOverrides.value = {}
    const localLayerStored = persistOverrides()
    previewing.value = false
    rebuildFromLayers(true)
    saveState.value = 'success'
    message.value = localLayerStored
      ? 'CFSM 已保存设置并返回新的 theme_options。'
      : 'CFSM 已保存设置，但浏览器拒绝清除持久化本地覆盖；当前会话已使用后端结果。'

    try {
      const config = await fetchSiteConfig(base, {
        fetcher: options.fetcher,
        storage: requestStorage,
        timeoutMs: options.timeoutMs,
      })
      hydrateBackend(config.themeOptions, config.preferredTheme, true)
      message.value = localLayerStored
        ? 'CFSM 后端设置已保存并完成配置回读。'
        : 'CFSM 后端设置已保存并完成回读，但浏览器拒绝清除持久化本地覆盖。'
      return { saved: true, config, refetchWarning: null }
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'Unknown config re-fetch error'
      refetchWarning.value = warning
      message.value = localLayerStored
        ? '设置已保存；但 /api/config 回读失败，当前使用保存响应中的配置。'
        : '设置已保存；但配置回读与持久化本地覆盖清理均失败，当前会话使用保存响应。'
      return { saved: true, config: null, refetchWarning: warning }
    }
  }

  function clearStatus(): void {
    if (saveState.value !== 'saving') saveState.value = 'idle'
    saveError.value = null
    message.value = null
    refetchWarning.value = null
  }

  watch([runtime, resolvedTheme], applyRuntime, { deep: true })

  return {
    initialized,
    backendRaw,
    localOverrides,
    persisted,
    runtime,
    draft,
    previewing,
    draftIssues,
    saveState,
    saveError,
    message,
    refetchWarning,
    resolvedTheme,
    viewMode,
    localOverrideCount,
    hasLocalOverrides,
    hasDraftChanges,
    canSaveDraft,
    draftSnapshot,
    hasBackendCredential,
    initialize,
    hydrateBackend,
    previewDraft,
    resetDraft,
    setLocalSetting,
    setDashboardViewMode,
    cycleTheme,
    saveLocal,
    useBackend,
    saveBackend,
    clearStatus,
  }
})
