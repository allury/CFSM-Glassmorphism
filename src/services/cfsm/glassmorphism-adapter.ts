import type { CfsmServer, ProbeValue, SiteConfig } from '@/types/cfsm'
import { DEFAULT_PROBE_LABELS } from '@/constants/probes'
import type {
  GlassResourceMetric,
  GlassServer,
} from '@/types/glassmorphism'
import { latencyCarrierKeys } from './adapters'

function finiteNonNegative(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null
}

function probeMetric(value: ProbeValue): ProbeValue {
  if (value === false || value === null) return value
  return finiteNonNegative(value) ?? false
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
  const labels = config?.probeLabels ?? DEFAULT_PROBE_LABELS

  return {
    key: serverKey(server),
    id: server.id,
    sourceBase: server.source.base,
    sourceLabel: server.source.label,
    name: server.name,
    group: server.group,
    tags: server.tags,
    region: server.region,
    price: server.price,
    billingCycle: server.billingCycle,
    currency: server.currency,
    expireDate: server.expireDate,
    trafficLimit: server.trafficLimit,
    trafficCalculationType: server.trafficCalculationType,
    showExpire: server.systemConfig?.showExpire !== false,
    showTraffic: server.systemConfig?.showTraffic !== false,
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
      const latency = probeMetric(server.latency[carrier])
      const packetLossValue = probeMetric(server.packetLoss[carrier])
      const packetLoss = typeof packetLossValue === 'number'
        ? Math.min(packetLossValue, 100)
        : packetLossValue
      if (latency === false && packetLoss === false) return []
      return [{
        carrier,
        label: labels[carrier],
        latency,
        packetLoss,
      }]
    }),
    history: {
      latencySamples: server.latencyWindow.flatMap((sample) => (
        latencyCarrierKeys().flatMap((carrier) => {
          const value = sample[carrier]
          return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? [value] : []
        })
      )),
      packetLossSamples: server.packetLossWindow.flatMap((sample) => (
        latencyCarrierKeys().flatMap((carrier) => {
          const value = sample[carrier]
          return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? [value] : []
        })
      )),
    },
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
    cpuCores: finiteNonNegative(server.cpuCores),
    kernelVersion: server.kernelVersion,
    agentVersion: server.agentVersion,
    bootTime: finiteNonNegative(server.bootTime),
    lastUpdated: server.lastUpdated ?? server.timestamp,
  }
}

export interface GlassServerMapper {
  map(servers: readonly CfsmServer[], config: SiteConfig | null): GlassServer[]
}

export function createGlassServerMapper(): GlassServerMapper {
  const cache = new WeakMap<CfsmServer, { config: SiteConfig | null, value: GlassServer }>()

  return {
    map(servers, config) {
      return servers.map((server) => {
        const cached = cache.get(server)
        if (cached?.config === config) return cached.value
        const value = toGlassServer(server, config)
        cache.set(server, { config, value })
        return value
      })
    },
  }
}
