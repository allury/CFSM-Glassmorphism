import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type {
  DashboardThemeMode,
  DashboardViewMode,
} from '@/types/glassmorphism'

export const DASHBOARD_PREFERENCES_KEY = 'cfsm-glassmorphism.dashboard.v1'

export interface DashboardPreferencesSnapshot {
  themeMode: DashboardThemeMode | null
  viewMode: DashboardViewMode
  offlineLast: boolean
  favoriteKeys: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function themeModeValue(value: unknown): DashboardThemeMode | null {
  return value === 'system' || value === 'light' || value === 'dark' ? value : null
}

function viewModeValue(value: unknown): DashboardViewMode {
  return value === 'list' || value === 'mini' || value === 'compact' ? value : 'card'
}

export function normalizeDashboardPreferences(value: unknown): DashboardPreferencesSnapshot {
  const input = isRecord(value) ? value : {}
  const favorites = Array.isArray(input.favoriteKeys)
    ? input.favoriteKeys.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []

  return {
    themeMode: themeModeValue(input.themeMode),
    viewMode: viewModeValue(input.viewMode),
    offlineLast: input.offlineLast === true,
    favoriteKeys: [...new Set(favorites)],
  }
}

function readPreferences(): DashboardPreferencesSnapshot {
  if (typeof window === 'undefined') return normalizeDashboardPreferences(null)
  try {
    const stored = window.localStorage.getItem(DASHBOARD_PREFERENCES_KEY)
    return normalizeDashboardPreferences(stored ? JSON.parse(stored) as unknown : null)
  } catch {
    return normalizeDashboardPreferences(null)
  }
}

export const useDashboardPreferencesStore = defineStore('dashboard-preferences', () => {
  const snapshot = readPreferences()
  const themeMode = ref<DashboardThemeMode>(snapshot.themeMode ?? 'system')
  const hasExplicitTheme = ref(snapshot.themeMode !== null)
  const viewMode = ref<DashboardViewMode>(snapshot.viewMode)
  const offlineLast = ref(snapshot.offlineLast)
  const favoriteKeys = ref<string[]>(snapshot.favoriteKeys)
  const systemDark = ref(
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const initialized = ref(false)

  const favorites = computed<ReadonlySet<string>>(() => new Set(favoriteKeys.value))
  const resolvedTheme = computed<'light' | 'dark'>(() => (
    themeMode.value === 'system'
      ? systemDark.value ? 'dark' : 'light'
      : themeMode.value
  ))

  function applyTheme(): void {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = resolvedTheme.value
    document.documentElement.style.colorScheme = resolvedTheme.value
  }

  function persist(): void {
    if (!initialized.value || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(DASHBOARD_PREFERENCES_KEY, JSON.stringify({
        themeMode: hasExplicitTheme.value ? themeMode.value : null,
        viewMode: viewMode.value,
        offlineLast: offlineLast.value,
        favoriteKeys: favoriteKeys.value,
      }))
    } catch {
      // Storage can be unavailable in private/restricted browsing; runtime state remains usable.
    }
  }

  function initialize(): void {
    if (initialized.value) return

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      systemDark.value = media.matches
      media.addEventListener('change', (event) => {
        systemDark.value = event.matches
      })
    }

    initialized.value = true
    applyTheme()
    persist()
  }

  function adoptPreferredTheme(preferredTheme: 'auto' | 'light' | 'dark'): void {
    if (hasExplicitTheme.value) return
    themeMode.value = preferredTheme === 'auto' ? 'system' : preferredTheme
  }

  function cycleTheme(): void {
    const modes: DashboardThemeMode[] = ['system', 'light', 'dark']
    const index = modes.indexOf(themeMode.value)
    themeMode.value = modes[(index + 1) % modes.length] ?? 'system'
    hasExplicitTheme.value = true
  }

  function isFavorite(key: string): boolean {
    return favorites.value.has(key)
  }

  function toggleFavorite(key: string): void {
    favoriteKeys.value = isFavorite(key)
      ? favoriteKeys.value.filter((item) => item !== key)
      : [...favoriteKeys.value, key]
  }

  watch([themeMode, systemDark], applyTheme)
  watch([themeMode, hasExplicitTheme, viewMode, offlineLast, favoriteKeys], persist, { deep: true })

  return {
    themeMode,
    viewMode,
    offlineLast,
    favoriteKeys,
    favorites,
    resolvedTheme,
    initialize,
    adoptPreferredTheme,
    cycleTheme,
    isFavorite,
    toggleFavorite,
  }
})
