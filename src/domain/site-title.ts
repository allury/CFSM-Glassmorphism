export const DEFAULT_SITE_TITLE = 'CF Server Monitor'

export type SiteTitleResolution =
  | { state: 'pending', title: null }
  | { state: 'ready' | 'fallback', title: string }

export function resolveSiteTitle(
  siteTitle: string | null | undefined,
  pending: boolean,
): SiteTitleResolution {
  const title = siteTitle?.trim()
  if (title) return { state: 'ready', title }
  if (pending) return { state: 'pending', title: null }
  return { state: 'fallback', title: DEFAULT_SITE_TITLE }
}

export function detailDocumentTitle(
  serverName: string | null | undefined,
  site: SiteTitleResolution,
): string | null {
  const name = serverName?.trim()
  if (name && site.title) return `${name} · ${site.title}`
  return name || site.title
}
