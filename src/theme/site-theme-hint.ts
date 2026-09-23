import { resolveThemeSettings, type ThemeMode } from './settings'

/** 非权威的冷启动明暗暂存值；它不属于默认 / 后端 / 本地覆盖三层设置。 */
export const SITE_THEME_HINT_STORAGE_KEY = 'cfsm-glassmorphism.site-theme-hint.v1'

export function parseSiteThemeHint(raw: string | null): ThemeMode | null {
  if (raw === null) return null
  let value: unknown
  try {
    value = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  if (!('version' in value) || value.version !== 1) return null
  if (!('themeMode' in value)) return null
  const mode = value.themeMode
  return mode === 'beijing' || mode === 'system' || mode === 'light' || mode === 'dark'
    ? mode
    : null
}

/** 只取后端 theme_options / preferred_theme，永不混入访客本地覆盖。 */
export function backendSiteThemeMode(
  options: unknown,
  preferredTheme: 'auto' | 'light' | 'dark',
): ThemeMode {
  return resolveThemeSettings(options, {}, preferredTheme).themeMode
}
