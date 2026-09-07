import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  normalizeDashboardPreferences,
  useDashboardPreferencesStore,
} from '@/stores/dashboard-preferences'

describe('dashboard local preferences', () => {
  it('accepts only supported visual preferences and deduplicates stable favorites', () => {
    expect(normalizeDashboardPreferences({
      themeMode: 'dark',
      viewMode: 'mini',
      offlineLast: true,
      favoriteKeys: ['https%3A%2F%2Fa.example:one', 'https%3A%2F%2Fa.example:one', '', 42],
    })).toEqual({
      themeMode: 'dark',
      viewMode: 'mini',
      offlineLast: true,
      favoriteKeys: ['https%3A%2F%2Fa.example:one'],
    })
  })

  it('falls back safely for malformed or future values', () => {
    expect(normalizeDashboardPreferences({
      themeMode: 'beijing',
      viewMode: 'earth',
      offlineLast: 'true',
      favoriteKeys: null,
    })).toEqual({
      themeMode: null,
      viewMode: 'card',
      offlineLast: false,
      favoriteKeys: [],
    })
    expect(normalizeDashboardPreferences('invalid')).toEqual({
      themeMode: null,
      viewMode: 'card',
      offlineLast: false,
      favoriteKeys: [],
    })
  })

  it('adopts the site preference only until the user chooses a theme', () => {
    setActivePinia(createPinia())
    const preferences = useDashboardPreferencesStore()

    preferences.initialize()
    preferences.adoptPreferredTheme('dark')
    expect(preferences.themeMode).toBe('dark')

    preferences.cycleTheme()
    preferences.adoptPreferredTheme('light')
    expect(preferences.themeMode).toBe('system')
  })
})
