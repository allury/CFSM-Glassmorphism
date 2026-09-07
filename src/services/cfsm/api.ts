import type {
  CfsmServer,
  HistorySeries,
  ServerCollection,
  ServerSourcesResult,
  SiteConfig,
  ThemeOptionsSaveResult,
} from '@/types/cfsm'
import {
  isRecord,
  normalizeHistory,
  normalizeServer,
  normalizeServerCollection,
  normalizeSiteConfig,
  normalizeThemeOptionsSave,
} from './adapters'
import { apiSource, getApiBases } from './config'
import { CfsmRequestError, cfsmGet, cfsmPost, type CfsmRequestOptions } from './http'

export const HISTORY_HOURS = [0.167, 0.5, 1, 6, 12, 24, 48, 96, 168] as const
export type HistoryHours = (typeof HISTORY_HOURS)[number]

type SharedRequestOptions = Partial<Pick<
  CfsmRequestOptions,
  'fetcher' | 'storage' | 'signal' | 'timeoutMs' | 'includeAuth' | 'includeTurnstile'
>>

export function isHistoryHours(value: number): value is HistoryHours {
  return HISTORY_HOURS.some((hours) => hours === value)
}

export async function fetchSiteConfig(
  base = getApiBases()[0],
  options: SharedRequestOptions = {},
): Promise<SiteConfig> {
  if (!base) throw new Error('No CFSM API base is configured')
  const payload = await cfsmGet('/api/config', { ...options, base })
  return normalizeSiteConfig(payload)
}

export async function fetchServers(
  base = getApiBases()[0],
  options: SharedRequestOptions = {},
  sourceIndex = 0,
): Promise<ServerCollection> {
  if (!base) throw new Error('No CFSM API base is configured')
  const source = apiSource(base, sourceIndex)
  const payload = await cfsmGet('/api/servers', { ...options, base })
  return normalizeServerCollection(payload, source)
}

export async function fetchAllServerSources(
  bases = getApiBases(),
  options: SharedRequestOptions = {},
): Promise<ServerSourcesResult> {
  const settled = await Promise.allSettled(
    bases.map((base, index) => fetchServers(base, options, index)),
  )
  const collections: ServerCollection[] = []
  const failures: ServerSourcesResult['failures'] = []

  settled.forEach((result, index) => {
    const base = bases[index]
    if (!base) return
    if (result.status === 'fulfilled') {
      collections.push(result.value)
      return
    }

    const reason: unknown = result.reason
    failures.push({
      source: apiSource(base, index),
      message: reason instanceof Error ? reason.message : 'Unknown CFSM server error',
      status: reason instanceof CfsmRequestError ? reason.status : null,
      code: reason instanceof CfsmRequestError ? reason.code : null,
    })
  })

  return { collections, failures }
}

export async function fetchServer(
  id: string,
  base: string,
  options: SharedRequestOptions = {},
) {
  const source = apiSource(base)
  const query = new URLSearchParams({ id }).toString()
  const payload = await cfsmGet('/api/server?' + query, { ...options, base })
  return normalizeServer(payload, source)
}

export async function fetchServerFromSources(
  id: string,
  bases: readonly string[],
  options: SharedRequestOptions = {},
  preferredBase?: string,
): Promise<CfsmServer> {
  const uniqueBases = [...new Set(bases)]
  if (uniqueBases.length === 0) throw new Error('No CFSM API base is configured')

  if (preferredBase && uniqueBases.includes(preferredBase)) {
    return fetchServer(id, preferredBase, options)
  }

  const settled = await Promise.allSettled(
    uniqueBases.map((base) => fetchServer(id, base, options)),
  )
  for (const result of settled) {
    if (result.status === 'fulfilled') return result.value
  }

  const reasons = settled.flatMap((result) => {
    if (result.status === 'fulfilled') return []
    const reason: unknown = result.reason
    return [reason]
  })
  const meaningful = reasons.find((reason) => (
    !(reason instanceof CfsmRequestError) || reason.status !== 404
  ))
  throw meaningful ?? reasons[0] ?? new Error('CFSM server could not be resolved')
}

export async function fetchHistory(
  id: string,
  hours: HistoryHours,
  base: string,
  options: SharedRequestOptions = {},
): Promise<HistorySeries> {
  const source = apiSource(base)
  const query = new URLSearchParams({ id, hours: String(hours) }).toString()
  const payload = await cfsmGet('/api/history/all?' + query, { ...options, base })
  return { serverId: id, source, points: normalizeHistory(payload) }
}

export async function saveThemeOptions(
  themeOptions: Record<string, unknown>,
  base = getApiBases()[0],
  options: SharedRequestOptions = {},
): Promise<ThemeOptionsSaveResult> {
  if (!base) throw new Error('No CFSM API base is configured')
  if (!isRecord(themeOptions)) throw new Error('Theme options must be a non-array object')
  const payload = await cfsmPost('/api/theme_options', { theme_options: themeOptions }, {
    ...options,
    base,
  })
  return normalizeThemeOptionsSave(payload)
}
