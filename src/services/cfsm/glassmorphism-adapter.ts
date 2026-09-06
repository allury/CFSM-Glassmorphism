import type { CfsmServer, SiteConfig } from '@/types/cfsm'
import type {
  GlassResourceMetric,
  GlassServer,
} from '@/types/glassmorphism'
import { latencyCarrierKeys } from './adapters'

const DEFAULT_LATENCY_LABELS = {
  ct: 'CT',
  cu: 'CU',
  cm: 'CM',
  bd: 'BGP',
} as const

function finiteNonNegative(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null
}
function boundedPercentage(value: number | null): number | null {
  const metric = finiteNonNegative(value)
  return metric === null ? null : Math.min(metric, 100)
}

function resourceMetric(usedValue: number | null, totalValue: number | null): GlassResourceMetric {
  const used = finiteNonNegative(usedValue)
  const total = finiteNonNegative(totalValue)
  const percentage = used !== null && total !== null && total > 0
    ? Math.min(Math.max((used / total) * 100, 0), 100)
    : null
  return { used, total, percentage }
}

function serverKey(server: CfsmServer): string {
  return encodeURIComponent(server.source.base) + ':' + server.id
}

export function toGlassServer(server: CfsmServer, config: SiteConfig | null): GlassServer {
  const labels = config?.latencyLabels ?? DEFAULT_LATENCY_LABELS

  return {
    key: serverKey(server),
    id: server.id,
    sourceBase: server.source.base,
    sourceLabel: server.source.label,
    name: server.name,
    group: server.group,
    tags: server.tags,
    region: server.region,
    online: server.online,
    sortOrder: server.sortOrder,
    cpu: boundedPercentage(server.cpu),
    load: {
      one: finiteNonNegative(server.load1),
      five: finiteNonNegative(server.load5),
      fifteen: finiteNonNegative(server.load15),
    },
    memory: resourceMetric(server.memoryUsed, server.memoryTotal),
    swap: resourceMetric(server.swapUsed, server.swapTotal),
    disk: resourceMetric(server.diskUsed, server.diskTotal),
    network: {
      inSpeed: finiteNonNegative(server.networkInSpeed),
      outSpeed: finiteNonNegative(server.networkOutSpeed),
      received: finiteNonNegative(server.networkReceived),
      transmitted: finiteNonNegative(server.networkTransmitted),
      monthlyReceived: finiteNonNegative(server.monthlyNetworkReceived),
      monthlyTransmitted: finiteNonNegative(server.monthlyNetworkTransmitted),
    },
    processes: finiteNonNegative(server.processes),
    tcpConnections: finiteNonNegative(server.tcpConnections),
    udpConnections: finiteNonNegative(server.udpConnections),
    latency: latencyCarrierKeys().flatMap((carrier) => {
      const latency = finiteNonNegative(server.latency[carrier])
      const packetLoss = boundedPercentage(server.packetLoss[carrier])
      if (latency === null && packetLoss === null) return []
      return [{
        carrier,
        label: labels[carrier],
        latency,
        packetLoss,
      }]
    }),
    gpus: server.gpus.map((gpu) => ({
      id: gpu.id,
      name: gpu.name,
      utilization: boundedPercentage(gpu.utilization),
    })),
    connectivity: {
      ipv4: server.ipV4Reachable,
      ipv6: server.ipV6Reachable,
    },
    operatingSystem: server.operatingSystem,
    architecture: server.architecture,
    cpuInfo: server.cpuInfo,
    lastUpdated: server.lastUpdated ?? server.timestamp,
  }
}
