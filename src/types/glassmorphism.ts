import type { LatencyCarrier, Reachability } from './cfsm'

export interface GlassResourceMetric {
  used: number | null
  total: number | null
  percentage: number | null
}
export interface GlassLatencyMetric {
  carrier: LatencyCarrier
  label: string
  latency: number | null
  packetLoss: number | null
}

export interface GlassGpuMetric {
  id: string
  name: string
  utilization: number | null
}

export interface GlassServer {
  key: string
  id: string
  sourceBase: string
  sourceLabel: string
  name: string
  group: string
  tags: string[]
  region: string | null
  online: boolean
  sortOrder: number | null
  cpu: number | null
  load: {
    one: number | null
    five: number | null
    fifteen: number | null
  }
  memory: GlassResourceMetric
  swap: GlassResourceMetric
  disk: GlassResourceMetric
  network: {
    inSpeed: number | null
    outSpeed: number | null
    received: number | null
    transmitted: number | null
    monthlyReceived: number | null
    monthlyTransmitted: number | null
  }
  processes: number | null
  tcpConnections: number | null
  udpConnections: number | null
  latency: GlassLatencyMetric[]
  gpus: GlassGpuMetric[]
  connectivity: {
    ipv4: Reachability
    ipv6: Reachability
  }
  operatingSystem: string | null
  architecture: string | null
  cpuInfo: string | null
  lastUpdated: number | null
}

export type DashboardViewMode = 'card' | 'list'
export type DashboardSort = 'order' | 'name' | 'status' | 'cpu' | 'memory' | 'network'

export interface DashboardSummary {
  total: number
  online: number
  offline: number
  averageCpu: number | null
  memory: GlassResourceMetric
  disk: GlassResourceMetric
  networkInSpeed: number | null
  networkOutSpeed: number | null
  trafficReceived: number | null
  trafficTransmitted: number | null
}

export interface GlassServerGroup {
  name: string
  servers: GlassServer[]
}
