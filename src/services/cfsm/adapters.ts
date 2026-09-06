import type {
  ApiSource,
  CfsmServer,
  DiskIoMetrics,
  GpuMetrics,
  HistoryPoint,
  LatencyCarrier,
  LatencyValues,
  LatencyWindowSample,
  LatestReportUpdate,
  ServerCollection,
  ServerSystemConfig,
  SiteConfig,
  ThemeOptionsSaveResult,
} from '@/types/cfsm'

const LATENCY_CARRIERS = ['ct', 'cu', 'cm', 'bd'] as const
const FIVE_MINUTES_MS = 5 * 60 * 1000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function objectValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function preferredThemeValue(value: unknown): SiteConfig['preferredTheme'] {
  return value === 'dark' || value === 'light' ? value : 'auto'
}

function defaultLanguageValue(value: unknown): SiteConfig['defaultLanguage'] {
  return value === 'zh' || value === 'en' ? value : 'auto'
}

function reachabilityValue(value: unknown): '0' | '1' | null {
  if (value === '1' || value === 1 || value === true) return '1'
  if (value === '0' || value === 0 || value === false) return '0'
  return null
}

function splitTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [...new Set(values.map(stringValue).filter((item): item is string => item !== null))]
}

function loadValues(value: unknown): [number | null, number | null, number | null] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.trim().split(/\s+/)
      : []
  return [numberValue(values[0]), numberValue(values[1]), numberValue(values[2])]
}

function latencyValues(value: Record<string, unknown>, prefix: 'ping' | 'loss'): LatencyValues {
  return {
    ct: numberValue(value[prefix + '_ct']),
    cu: numberValue(value[prefix + '_cu']),
    cm: numberValue(value[prefix + '_cm']),
    bd: numberValue(value[prefix + '_bd']),
  }
}

function latencyWindow(value: unknown): LatencyWindowSample[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const timestamp = numberValue(entry.ts)
    if (timestamp === null) return []
    return [{
      timestamp,
      ct: numberValue(entry.ct),
      cu: numberValue(entry.cu),
      cm: numberValue(entry.cm),
      bd: numberValue(entry.bd),
    }]
  })
}

function diskIoValue(value: unknown): DiskIoMetrics | undefined {
  if (!isRecord(value)) return undefined
  const disk = {
    readBps: numberValue(value.read_bps) ?? 0,
    writeBps: numberValue(value.write_bps) ?? 0,
    readIops: numberValue(value.read_iops) ?? 0,
    writeIops: numberValue(value.write_iops) ?? 0,
    awaitMs: numberValue(value.await_ms) ?? 0,
    utilization: numberValue(value.util) ?? 0,
  }
  return Object.values(disk).some((metric) => metric !== 0) ? disk : undefined
}

function legacyHistoryDiskIoValue(value: Record<string, unknown>): DiskIoMetrics | undefined {
  return diskIoValue({
    read_bps: value.disk_read_bps,
    write_bps: value.disk_write_bps,
    read_iops: value.disk_read_iops,
    write_iops: value.disk_write_iops,
    await_ms: value.disk_await_ms,
    util: value.disk_util,
  })
}

function gpuValues(value: unknown): GpuMetrics[] {
  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown
    } catch {
      return []
    }
  }
  if (!Array.isArray(candidate)) return []

  return candidate.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const id = stringValue(entry.id)
    const name = stringValue(entry.name)
    if (id === null || name === null) return []
    return [{ id, name, utilization: numberValue(entry.info) }]
  })
}

function latestReportUpdates(value: unknown): LatestReportUpdate[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const serverId = stringValue(entry.serverId)
    if (serverId === null) return []
    const samples = Array.isArray(entry.samples)
      ? entry.samples.flatMap((sample) => {
          if (!isRecord(sample)) return []
          const timestamp = numberValue(sample.ts)
          const data = objectValue(sample.data)
          return timestamp === null ? [] : [{ timestamp, data }]
        })
      : []
    return [{
      serverId,
      reportTimestamp: numberValue(entry.reportTs),
      reportAgeMs: numberValue(entry.reportAgeMs),
      samples,
    }]
  })
}

function systemConfig(value: unknown): ServerSystemConfig | undefined {
  if (!isRecord(value)) return undefined
  const result: ServerSystemConfig = {}
  if ('show_price' in value) result.showPrice = booleanValue(value.show_price)
  if ('show_expire' in value) result.showExpire = booleanValue(value.show_expire)
  if ('show_tf' in value) result.showTraffic = booleanValue(value.show_tf)
  const historyPoints = numberValue(value.long_history_points)
  if (historyPoints !== null) result.longHistoryPoints = historyPoints
  return Object.keys(result).length > 0 ? result : undefined
}

function isOnline(value: Record<string, unknown>, now: number): boolean {
  if (value.is_online === true || value.is_online === false
    || value.is_online === 1 || value.is_online === 0
    || value.is_online === '1' || value.is_online === '0'
    || value.is_online === 'true' || value.is_online === 'false') {
    return booleanValue(value.is_online)
  }
  const updated = numberValue(value.last_updated) ?? numberValue(value.timestamp)
  return updated !== null && updated <= now + FIVE_MINUTES_MS && now - updated <= FIVE_MINUTES_MS
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(label + ' response must be an object')
  return value
}

export function normalizeSiteConfig(value: unknown): SiteConfig {
  const input = requiredRecord(value, 'Config')
  const latencyConfig = objectValue(input.latency_window)
  const title = stringValue(input.site_title)

  return {
    version: stringValue(input.version),
    latestWorkersVersion: stringValue(input.last_workers_version),
    latestAgentVersion: stringValue(input.last_agent_version),
    isPublic: booleanValue(input.is_public),
    authorization: booleanValue(input.authorization),
    turnstileEnabled: booleanValue(input.turnstile_enabled),
    turnstileLoginEnabled: booleanValue(input.turnstile_login_enabled),
    turnstileSiteKey: stringValue(input.turnstile_site_key),
    latencyLabels: {
      ct: stringValue(input.custom_ct_name) ?? 'CT',
      cu: stringValue(input.custom_cu_name) ?? 'CU',
      cm: stringValue(input.custom_cm_name) ?? 'CM',
      bd: stringValue(input.custom_bd_name) ?? 'BGP',
    },
    siteTitle: title ?? 'CF Server Monitor',
    preferredTheme: preferredThemeValue(input.preferred_theme),
    defaultLanguage: defaultLanguageValue(input.default_language),
    themeOptions: objectValue(input.theme_options),
    verified: booleanValue(input.verified),
    turnstileVerified: stringValue(input.turnstile_verified),
    frontendWebsocketTimeoutMinutes: numberValue(input.frontend_ws_timeout_minutes) ?? 0,
    longHistoryPoints: numberValue(input.long_history_points) ?? 120,
    latencyWindow: {
      points: numberValue(latencyConfig.points) ?? 20,
      hours: numberValue(latencyConfig.hours) ?? 2,
    },
  }
}

export function normalizeServer(
  value: unknown,
  source: ApiSource,
  now = Date.now(),
): CfsmServer {
  const input = requiredRecord(value, 'Server')
  const id = stringValue(input.id)
  if (id === null) throw new Error('Server response is missing a valid id')
  const [load1, load5, load15] = loadValues(input.load_avg)

  return {
    id,
    source,
    name: stringValue(input.name) ?? id,
    group: stringValue(input.server_group) ?? '',
    tags: splitTags(input.tags),
    price: stringValue(input.price),
    billingCycle: stringValue(input.billing_cycle),
    autoRenewal: stringValue(input.auto_renewal),
    currency: stringValue(input.currency),
    expireDate: stringValue(input.expire_date),
    trafficLimit: stringValue(input.traffic_limit),
    trafficCalculationType: stringValue(input.traffic_calc_type),
    resetDay: numberValue(input.reset_day),
    reportInterval: numberValue(input.report_interval),
    websocketReportInterval: numberValue(input.wss_report_interval),
    hidden: booleanValue(input.is_hidden),
    sortOrder: numberValue(input.sort_order),
    online: isOnline(input, now),
    cpu: numberValue(input.cpu),
    load1,
    load5,
    load15,
    networkInSpeed: numberValue(input.net_in_speed),
    networkOutSpeed: numberValue(input.net_out_speed),
    networkReceived: numberValue(input.net_rx),
    networkTransmitted: numberValue(input.net_tx),
    monthlyNetworkReceived: numberValue(input.net_rx_monthly),
    monthlyNetworkTransmitted: numberValue(input.net_tx_monthly),
    processes: numberValue(input.processes),
    tcpConnections: numberValue(input.tcp_conn),
    udpConnections: numberValue(input.udp_conn),
    latency: latencyValues(input, 'ping'),
    packetLoss: latencyValues(input, 'loss'),
    latencyWindow: latencyWindow(input.ping),
    packetLossWindow: latencyWindow(input.loss),
    memoryTotal: numberValue(input.ram_total),
    memoryUsed: numberValue(input.ram_used),
    swapTotal: numberValue(input.swap_total),
    swapUsed: numberValue(input.swap_used),
    diskTotal: numberValue(input.disk_total),
    diskUsed: numberValue(input.disk_used),
    diskIo: diskIoValue(input.disk),
    cpuCores: numberValue(input.cpu_cores),
    cpuInfo: stringValue(input.cpu_info),
    gpus: gpuValues(input.gpu_info),
    architecture: stringValue(input.arch),
    operatingSystem: stringValue(input.os),
    kernelVersion: stringValue(input.kernel_version),
    region: stringValue(input.region),
    ipV4Reachable: reachabilityValue(input.ip_v4),
    ipV6Reachable: reachabilityValue(input.ip_v6),
    bootTime: numberValue(input.boot_time),
    agentVersion: stringValue(input.agent_version),
    lastUpdated: numberValue(input.last_updated),
    timestamp: numberValue(input.timestamp),
    latestReportUpdates: latestReportUpdates(input.latestReportUpdates),
    systemConfig: systemConfig(input.sysConfig),
  }
}

export function normalizeServerCollection(
  value: unknown,
  source: ApiSource,
  now = Date.now(),
): ServerCollection {
  const input = requiredRecord(value, 'Servers')
  if (!Array.isArray(input.servers)) throw new Error('Servers response is missing the servers array')

  return {
    source,
    servers: input.servers.flatMap((server) => {
      if (!isRecord(server) || stringValue(server.id) === null) return []
      return [normalizeServer(server, source, now)]
    }),
    stats: objectValue(input.stats),
    systemConfig: systemConfig(input.sysConfig),
  }
}

export function normalizeHistory(value: unknown): HistoryPoint[] {
  if (!Array.isArray(value)) throw new Error('History response must be an array')

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const timestamp = numberValue(entry.timestamp)
    if (timestamp === null) return []
    const [load1, load5, load15] = loadValues(entry.load_avg)

    return [{
      timestamp,
      cpu: numberValue(entry.cpu),
      memoryUsed: numberValue(entry.ram_used),
      memoryTotal: numberValue(entry.ram_total),
      swapUsed: numberValue(entry.swap_used),
      swapTotal: numberValue(entry.swap_total),
      diskUsed: numberValue(entry.disk_used),
      diskTotal: numberValue(entry.disk_total),
      networkInSpeed: numberValue(entry.net_in_speed),
      networkOutSpeed: numberValue(entry.net_out_speed),
      networkReceived: numberValue(entry.net_rx),
      networkTransmitted: numberValue(entry.net_tx),
      load1,
      load5,
      load15,
      temperature: numberValue(entry.temperature),
      diskIo: diskIoValue(entry.disk) ?? legacyHistoryDiskIoValue(entry),
    }]
  })
}

export function normalizeThemeOptionsSave(value: unknown): ThemeOptionsSaveResult {
  const input = requiredRecord(value, 'Theme options save')
  return {
    success: input.success === true,
    themeOptions: objectValue(input.theme_options),
    message: stringValue(input.message),
  }
}

export function latencyCarrierKeys(): readonly LatencyCarrier[] {
  return LATENCY_CARRIERS
}
