export type NullableNumber = number | null
export type Reachability = '0' | '1' | null
export type LatencyCarrier = 'ct' | 'cu' | 'cm' | 'bd'

export interface ApiSource {
  base: string
  label: string
}

export type LatencyValues = Record<LatencyCarrier, NullableNumber>

export interface LatencyWindowSample extends LatencyValues {
  timestamp: number
}

export interface DiskIoMetrics {
  readBps: number
  writeBps: number
  readIops: number
  writeIops: number
  awaitMs: number
  utilization: number
}

export interface GpuMetrics {
  id: string
  name: string
  utilization: NullableNumber
}

export interface ServerSystemConfig {
  showPrice?: boolean
  showExpire?: boolean
  showTraffic?: boolean
  longHistoryPoints?: number
}

export interface ReportSample {
  timestamp: number
  data: Record<string, unknown>
}

export interface LatestReportUpdate {
  serverId: string
  reportTimestamp: NullableNumber
  reportAgeMs: NullableNumber
  samples: ReportSample[]
}

export interface CfsmServer {
  id: string
  source: ApiSource
  name: string
  group: string
  tags: string[]
  price: string | null
  billingCycle: string | null
  autoRenewal: string | null
  currency: string | null
  expireDate: string | null
  trafficLimit: string | null
  trafficCalculationType: string | null
  resetDay: NullableNumber
  reportInterval: NullableNumber
  websocketReportInterval: NullableNumber
  hidden: boolean
  sortOrder: NullableNumber
  online: boolean
  cpu: NullableNumber
  load1: NullableNumber
  load5: NullableNumber
  load15: NullableNumber
  networkInSpeed: NullableNumber
  networkOutSpeed: NullableNumber
  networkReceived: NullableNumber
  networkTransmitted: NullableNumber
  monthlyNetworkReceived: NullableNumber
  monthlyNetworkTransmitted: NullableNumber
  processes: NullableNumber
  tcpConnections: NullableNumber
  udpConnections: NullableNumber
  latency: LatencyValues
  packetLoss: LatencyValues
  latencyWindow: LatencyWindowSample[]
  packetLossWindow: LatencyWindowSample[]
  memoryTotal: NullableNumber
  memoryUsed: NullableNumber
  swapTotal: NullableNumber
  swapUsed: NullableNumber
  diskTotal: NullableNumber
  diskUsed: NullableNumber
  diskIo?: DiskIoMetrics
  cpuCores: NullableNumber
  cpuInfo: string | null
  gpus: GpuMetrics[]
  architecture: string | null
  operatingSystem: string | null
  kernelVersion: string | null
  region: string | null
  ipV4Reachable: Reachability
  ipV6Reachable: Reachability
  bootTime: NullableNumber
  agentVersion: string | null
  lastUpdated: NullableNumber
  timestamp: NullableNumber
  latestReportUpdates: LatestReportUpdate[]
  systemConfig?: ServerSystemConfig
}

export interface SiteConfig {
  version: string | null
  latestWorkersVersion: string | null
  latestAgentVersion: string | null
  isPublic: boolean
  authorization: boolean
  turnstileEnabled: boolean
  turnstileLoginEnabled: boolean
  turnstileSiteKey: string | null
  latencyLabels: Record<LatencyCarrier, string>
  siteTitle: string
  preferredTheme: 'auto' | 'dark' | 'light'
  defaultLanguage: 'auto' | 'zh' | 'en'
  themeOptions: Record<string, unknown>
  verified: boolean
  turnstileVerified: string | null
  frontendWebsocketTimeoutMinutes: number
  longHistoryPoints: number
  latencyWindow: {
    points: number
    hours: number
  }
}

export interface ServerCollection {
  source: ApiSource
  servers: CfsmServer[]
  stats: Record<string, unknown>
  systemConfig?: ServerSystemConfig
}

export interface HistoryPoint {
  timestamp: number
  cpu: NullableNumber
  memoryUsed: NullableNumber
  memoryTotal: NullableNumber
  swapUsed: NullableNumber
  swapTotal: NullableNumber
  diskUsed: NullableNumber
  diskTotal: NullableNumber
  networkInSpeed: NullableNumber
  networkOutSpeed: NullableNumber
  networkReceived: NullableNumber
  networkTransmitted: NullableNumber
  load1: NullableNumber
  load5: NullableNumber
  load15: NullableNumber
  temperature: NullableNumber
  diskIo?: DiskIoMetrics
}

export interface HistorySeries {
  serverId: string
  source: ApiSource
  points: HistoryPoint[]
}

export interface ThemeOptionsSaveResult {
  success: boolean
  themeOptions: Record<string, unknown>
  message: string | null
}

export type CfsmSocketState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface CfsmSocketSubscription {
  type: 'subscribe'
  server_ids: string[]
}

export interface CfsmBatchUpdate {
  type: 'batchUpdate'
  data?: unknown
  payload?: unknown
  metrics?: unknown
}
