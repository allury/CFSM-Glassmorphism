import type { IconName } from '@/constants/icons'
import type { DetailChartModel } from '@/domain/server-detail'
import { parseSettingKeys, type ThemeSettings } from '@/theme/settings'
import type { CfsmServer } from '@/types/cfsm'
import type { GlassServer } from '@/types/glassmorphism'
import {
  formatBytes,
  formatCount,
  formatLoad,
  formatPercent,
  formatPrice,
  formatSpeed,
  formatUptime,
  parseCfsmDate,
} from '@/utils/format'

export type GeneralCardKey =
  | 'currentTime' | 'onlineNodes' | 'offlineNodes' | 'avgCpu' | 'avgGpu' | 'avgLoad'
  | 'memory' | 'disk' | 'swap' | 'processes' | 'connections' | 'cpuCores' | 'gpuNodes'
  | 'totalTraffic' | 'uploadSpeed' | 'downloadSpeed' | 'trafficPeak'
  | 'highLoadNodes' | 'expiringNodes' | 'trafficWarnings'
  | 'regionDistribution' | 'systemDistribution'

export type QuickControlKey = 'favorite' | 'totalTraffic' | 'upload' | 'download' | 'peak' | 'offline' | 'highLoad' | 'expiring'
export type DetailCardKey =
  | 'nodePrice' | 'monthlyCost' | 'remainingTime' | 'cpuUsage' | 'gpuUsage'
  | 'memoryUsage' | 'swapUsage' | 'diskUsage' | 'load' | 'processes' | 'connections'
  | 'uptime' | 'uploadSpeed' | 'downloadSpeed' | 'totalTraffic' | 'trafficQuota'
export type ChartFamily = 'cpu' | 'memory' | 'disk' | 'network' | 'traffic' | 'gpu' | 'ping' | 'pingLoss'

const GENERAL_PRESETS: Record<ThemeSettings['generalCardPreset'], readonly GeneralCardKey[]> = {
  官方: ['onlineNodes', 'avgCpu', 'memory', 'disk', 'uploadSpeed', 'downloadSpeed'],
  基础: ['onlineNodes', 'offlineNodes', 'avgCpu', 'memory', 'disk', 'totalTraffic'],
  运维: ['onlineNodes', 'offlineNodes', 'avgCpu', 'avgLoad', 'highLoadNodes', 'processes', 'connections'],
  资源: ['avgCpu', 'avgGpu', 'memory', 'swap', 'disk', 'cpuCores', 'gpuNodes'],
  财务: ['expiringNodes', 'trafficWarnings', 'totalTraffic'],
  流量: ['totalTraffic', 'uploadSpeed', 'downloadSpeed', 'trafficPeak', 'trafficWarnings'],
  GPU: ['gpuNodes', 'avgGpu', 'avgCpu', 'memory'],
  资产: ['onlineNodes', 'offlineNodes', 'cpuCores', 'regionDistribution', 'systemDistribution'],
  完整: ['onlineNodes', 'offlineNodes', 'avgCpu', 'avgGpu', 'avgLoad', 'memory', 'swap', 'disk', 'processes', 'connections', 'cpuCores', 'gpuNodes', 'totalTraffic', 'uploadSpeed', 'downloadSpeed', 'trafficPeak', 'highLoadNodes', 'expiringNodes', 'trafficWarnings', 'regionDistribution', 'systemDistribution'],
  自定义: [],
}

const QUICK_PRESETS: Record<ThemeSettings['homeQuickControlPreset'], readonly QuickControlKey[]> = {
  基础: ['favorite', 'offline'],
  流量: ['totalTraffic', 'upload', 'download', 'peak'],
  运维: ['offline', 'highLoad', 'expiring'],
  完整: ['favorite', 'totalTraffic', 'upload', 'download', 'peak', 'offline', 'highLoad', 'expiring'],
  自定义: [],
}

const DETAIL_PRESETS: Record<ThemeSettings['detailMetricCardPreset'], readonly DetailCardKey[]> = {
  财务: ['nodePrice', 'monthlyCost', 'remainingTime', 'totalTraffic', 'trafficQuota', 'uptime', 'connections'],
  状态: ['cpuUsage', 'load', 'processes', 'connections', 'uptime', 'uploadSpeed', 'downloadSpeed', 'totalTraffic'],
  资源: ['cpuUsage', 'gpuUsage', 'memoryUsage', 'swapUsage', 'diskUsage', 'load', 'processes', 'connections', 'uptime'],
  网络: ['uploadSpeed', 'downloadSpeed', 'totalTraffic', 'trafficQuota', 'connections', 'uptime'],
  GPU: ['gpuUsage', 'cpuUsage', 'memoryUsage', 'diskUsage', 'load', 'uptime'],
  综合: ['nodePrice', 'monthlyCost', 'remainingTime', 'cpuUsage', 'gpuUsage', 'memoryUsage', 'swapUsage', 'diskUsage', 'load', 'processes', 'connections', 'uptime', 'uploadSpeed', 'downloadSpeed', 'totalTraffic', 'trafficQuota'],
  自定义: [],
}

const CHART_PRESETS: Record<ThemeSettings['chartDashboardPreset'], readonly ChartFamily[]> = {
  默认: ['cpu', 'memory', 'disk', 'network', 'traffic', 'ping', 'pingLoss'],
  精简: ['cpu', 'memory', 'network', 'ping'],
  资源: ['cpu', 'memory', 'disk'],
  网络: ['network', 'traffic'],
  GPU: ['gpu', 'cpu', 'memory'],
  延迟: ['ping', 'pingLoss'],
  运维: ['cpu', 'memory', 'disk', 'network', 'ping', 'pingLoss'],
  完整: ['cpu', 'memory', 'disk', 'network', 'traffic', 'gpu', 'ping', 'pingLoss'],
  自定义: [],
}

function selectedKeys<T extends string>(preset: readonly T[], custom: string, allowed: ReadonlySet<string>): T[] {
  const requested = preset.length > 0 ? preset : parseSettingKeys(custom)
  return requested.filter((key): key is T => allowed.has(key))
}

const GENERAL_KEYS = new Set<string>(GENERAL_PRESETS.完整)
const QUICK_KEYS = new Set<string>(QUICK_PRESETS.完整)
const DETAIL_KEYS = new Set<string>(DETAIL_PRESETS.综合)
const CHART_KEYS = new Set<string>(CHART_PRESETS.完整)

export function resolveGeneralCardKeys(settings: ThemeSettings): GeneralCardKey[] {
  return selectedKeys(GENERAL_PRESETS[settings.generalCardPreset], settings.generalCardKeys, GENERAL_KEYS)
}

export function resolveQuickControlKeys(settings: ThemeSettings): QuickControlKey[] {
  return selectedKeys(QUICK_PRESETS[settings.homeQuickControlPreset], settings.homeQuickControlKeys, QUICK_KEYS)
}

export function resolveDetailCardKeys(settings: ThemeSettings): DetailCardKey[] {
  return selectedKeys(DETAIL_PRESETS[settings.detailMetricCardPreset], settings.detailMetricCardKeys, DETAIL_KEYS)
}

export function resolveChartFamilies(settings: ThemeSettings): ChartFamily[] {
  return selectedKeys(CHART_PRESETS[settings.chartDashboardPreset], settings.chartDashboardTemplate, CHART_KEYS)
}

export function isHighLoad(server: GlassServer, threshold: number): boolean {
  return [server.cpu, server.memory.percentage, server.disk.percentage]
    .some((value) => value !== null && value >= threshold)
}

export function daysUntilExpiry(value: string | null, now = Date.now()): number | null {
  const date = parseCfsmDate(value)
  if (!date) return null
  const difference = date.getTime() - now
  return difference <= 0
    ? Math.floor(difference / 86_400_000)
    : Math.ceil(difference / 86_400_000)
}

const BILLING_CYCLE_DAYS: Readonly<Record<string, number>> = {
  month: 30,
  quarter: 90,
  half_year: 180,
  year: 365,
  two_years: 730,
  three_years: 1095,
  four_years: 1460,
  five_years: 1825,
}

/**
 * 按 CFSM 官方计费周期计算节点当前剩余价值。
 *
 * 未知周期不猜测；无效日期也保持不可用。这样首页可以复刻 Komari 的短金额行，
 * 又不会把 CFSM 的自由文本 `billing_cycle` 擅自解释成某个周期。
 */
export function remainingValue(server: GlassServer, now = Date.now()): number | null {
  const price = Number(server.price)
  if (!Number.isFinite(price) || price <= 0) return null

  const expiresAt = parseCfsmDate(server.expireDate)
  if (!expiresAt) return null
  const difference = expiresAt.getTime() - now
  if (difference <= 0) return 0
  if (difference / (86_400_000 * 365) > 100) return price

  const cycle = server.billingCycle?.trim().toLowerCase() ?? ''
  const cycleDays = BILLING_CYCLE_DAYS[cycle]
  if (!cycleDays) return null
  return Math.min(price, price * difference / (cycleDays * 86_400_000))
}

export function isExpiring(server: GlassServer, days: number, now = Date.now()): boolean {
  if (!server.showExpire) return false
  const remaining = daysUntilExpiry(server.expireDate, now)
  return remaining !== null && remaining >= 0 && remaining <= days
}

export function parseTrafficLimitBytes(value: string | null): number | null {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|kib|mb|mib|gb|gib|tb|tib)?$/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = (match[2] ?? 'gb').toLowerCase()
  const power: Record<string, number> = { b: 0, kb: 1, kib: 1, mb: 2, mib: 2, gb: 3, gib: 3, tb: 4, tib: 4 }
  return amount * (1024 ** (power[unit] ?? 3))
}

export function trafficUsage(server: GlassServer): { used: number, limit: number, percent: number } | null {
  if (!server.showTraffic) return null
  const limit = parseTrafficLimitBytes(server.trafficLimit)
  const rx = server.network.monthlyReceived
  const tx = server.network.monthlyTransmitted
  if (limit === null || (rx === null && tx === null)) return null
  const calculation = server.trafficCalculationType?.toLowerCase()
  const used = calculation === 'dl' ? rx : calculation === 'ul' ? tx
    : calculation === 'max' ? Math.max(rx ?? 0, tx ?? 0) : (rx ?? 0) + (tx ?? 0)
  if (used === null) return null
  return { used, limit, percent: (used / limit) * 100 }
}

export function isTrafficWarning(server: GlassServer, threshold: number): boolean {
  const usage = trafficUsage(server)
  return usage !== null && usage.percent >= threshold
}

export interface ProviderAlias { provider: string, aliases: string[] }

export function parseProviderAliases(value: string): ProviderAlias[] {
  return value.split(';').flatMap((entry) => {
    const separator = entry.indexOf(':')
    if (separator < 1) return []
    const provider = entry.slice(0, separator).trim()
    const aliases = entry.slice(separator + 1).split(',').map((item) => item.trim().toLocaleLowerCase()).filter(Boolean)
    return provider && aliases.length > 0 ? [{ provider, aliases }] : []
  })
}

export function matchProvider(server: GlassServer, aliases: readonly ProviderAlias[]): string | null {
  const values = [server.name, server.group, server.region, ...server.tags]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.normalize('NFKC').toLocaleLowerCase())
  return aliases.find((entry) => entry.aliases.some((alias) => values.some((value) => value.includes(alias))))?.provider ?? null
}

function average(values: Array<number | null>): number | null {
  const samples = values.filter((value): value is number => value !== null)
  return samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : null
}

function sum(values: Array<number | null>): number | null {
  const samples = values.filter((value): value is number => value !== null)
  return samples.length ? samples.reduce((total, value) => total + value, 0) : null
}

/** `icon` 使用与 Komari 一致的图标名（见 `@/constants/icons`），由 `AppIcon` 渲染。 */
export interface PresentationCard { key: string, icon: IconName, label: string, value: string, hint: string, percentage?: number | null }

export function buildGeneralCards(servers: GlassServer[], settings: ThemeSettings, now = Date.now()): PresentationCard[] {
  const online = servers.filter((server) => server.online)
  const resources = (selector: (server: GlassServer) => { used: number | null, total: number | null }) => {
    const used = sum(servers.map((server) => selector(server).used))
    const total = sum(servers.map((server) => selector(server).total))
    return { used, total, percentage: used !== null && total !== null && total > 0 ? used / total * 100 : null }
  }
  const memory = resources((server) => server.memory)
  const disk = resources((server) => server.disk)
  const swap = resources((server) => server.swap)
  const totalTraffic = sum(servers.map((server) => server.network.received === null && server.network.transmitted === null ? null : (server.network.received ?? 0) + (server.network.transmitted ?? 0)))
  const upload = sum(online.map((server) => server.network.outSpeed))
  const download = sum(online.map((server) => server.network.inSpeed))
  const speedSamples = online.flatMap((server) => [server.network.inSpeed, server.network.outSpeed]).filter((value): value is number => value !== null)
  const peak = speedSamples.length ? Math.max(...speedSamples) : null
  const avgCpu = average(online.map((server) => server.cpu))
  const avgGpu = average(online.flatMap((server) => server.gpus.map((gpu) => gpu.utilization)))
  const avgLoad = average(online.map((server) => server.load.one))
  const processCount = sum(online.map((server) => server.processes))
  const connectionCount = sum(online.map((server) => server.tcpConnections === null && server.udpConnections === null ? null : (server.tcpConnections ?? 0) + (server.udpConnections ?? 0)))
  const coreCount = sum(servers.map((server) => server.cpuCores))
  const regions = new Set(servers.map((server) => server.region).filter(Boolean)).size
  const systems = new Set(servers.map((server) => server.operatingSystem).filter(Boolean)).size
  const values: Record<GeneralCardKey, PresentationCard | null> = {
    currentTime: { key: 'currentTime', icon: 'tabler:clock', label: '当前时间', value: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now), hint: '浏览器本地时间' },
    onlineNodes: { key: 'onlineNodes', icon: 'tabler:plug-connected', label: '在线节点', value: `${online.length} / ${servers.length}`, hint: `${servers.length - online.length} 台离线` },
    offlineNodes: { key: 'offlineNodes', icon: 'tabler:plug-connected-x', label: '离线节点', value: String(servers.length - online.length), hint: '五分钟统一判定' },
    avgCpu: avgCpu === null ? null : { key: 'avgCpu', icon: 'tabler:cpu', label: '在线平均 CPU', value: formatPercent(avgCpu), hint: '有采样的在线节点' },
    avgGpu: avgGpu === null ? null : { key: 'avgGpu', icon: 'tabler:cpu-2', label: '平均 GPU', value: formatPercent(avgGpu), hint: '有 GPU 采样的在线节点' },
    avgLoad: avgLoad === null ? null : { key: 'avgLoad', icon: 'tabler:gauge', label: '平均负载', value: formatLoad(avgLoad), hint: '在线节点 1 分钟负载' },
    memory: memory.percentage === null ? null : { key: 'memory', icon: 'icon-park-outline:memory', label: '内存', value: formatPercent(memory.percentage), hint: `${formatBytes(memory.used === null ? null : memory.used * 1024 ** 2)} / ${formatBytes(memory.total === null ? null : memory.total * 1024 ** 2)}`, percentage: memory.percentage },
    disk: disk.percentage === null ? null : { key: 'disk', icon: 'tabler:server-2', label: '磁盘', value: formatPercent(disk.percentage), hint: `${formatBytes(disk.used === null ? null : disk.used * 1024 ** 2)} / ${formatBytes(disk.total === null ? null : disk.total * 1024 ** 2)}`, percentage: disk.percentage },
    swap: swap.percentage === null ? null : { key: 'swap', icon: 'icon-park-outline:switch', label: '交换内存', value: formatPercent(swap.percentage), hint: `${formatBytes(swap.used === null ? null : swap.used * 1024 ** 2)} / ${formatBytes(swap.total === null ? null : swap.total * 1024 ** 2)}`, percentage: swap.percentage },
    processes: processCount === null ? null : { key: 'processes', icon: 'tabler:list-numbers', label: '进程总数', value: formatCount(processCount), hint: '在线节点合计' },
    connections: connectionCount === null ? null : { key: 'connections', icon: 'tabler:activity', label: '连接总数', value: formatCount(connectionCount), hint: 'TCP + UDP' },
    cpuCores: coreCount === null ? null : { key: 'cpuCores', icon: 'tabler:cpu', label: 'CPU 核心', value: formatCount(coreCount), hint: '有数据节点合计' },
    gpuNodes: { key: 'gpuNodes', icon: 'tabler:cpu-2', label: 'GPU 节点', value: String(servers.filter((server) => server.gpus.length > 0).length), hint: '包含真实 gpu_info' },
    totalTraffic: totalTraffic === null ? null : { key: 'totalTraffic', icon: 'tabler:chart-histogram', label: '累计流量', value: formatBytes(totalTraffic), hint: '接收 + 发送' },
    uploadSpeed: upload === null ? null : { key: 'uploadSpeed', icon: 'tabler:arrow-big-up-lines', label: '实时上传', value: formatSpeed(upload), hint: '在线节点合计' },
    downloadSpeed: download === null ? null : { key: 'downloadSpeed', icon: 'tabler:arrow-big-down-lines', label: '实时下载', value: formatSpeed(download), hint: '在线节点合计' },
    trafficPeak: peak === null ? null : { key: 'trafficPeak', icon: 'tabler:chart-line', label: '实时峰值', value: formatSpeed(peak), hint: '单节点单方向最大值' },
    highLoadNodes: { key: 'highLoadNodes', icon: 'tabler:activity-heartbeat', label: '高负载节点', value: String(servers.filter((server) => isHighLoad(server, settings.homeHighLoadThreshold)).length), hint: `CPU / RAM / Disk ≥ ${settings.homeHighLoadThreshold}%` },
    expiringNodes: { key: 'expiringNodes', icon: 'tabler:calendar-exclamation', label: '即将到期', value: String(servers.filter((server) => isExpiring(server, settings.homeExpiringDays, now)).length), hint: `${settings.homeExpiringDays} 天内` },
    trafficWarnings: { key: 'trafficWarnings', icon: 'tabler:alert-triangle', label: '流量预警', value: String(servers.filter((server) => isTrafficWarning(server, settings.homeTrafficWarningThreshold)).length), hint: `可靠配额 ≥ ${settings.homeTrafficWarningThreshold}%` },
    regionDistribution: { key: 'regionDistribution', icon: 'tabler:map-pin', label: '地区分布', value: String(regions), hint: '有真实 region 的地区数' },
    systemDistribution: { key: 'systemDistribution', icon: 'tabler:device-desktop', label: '系统分布', value: String(systems), hint: '有真实 OS 的系统数' },
  }
  return resolveGeneralCardKeys(settings).flatMap((key) => values[key] ? [values[key] as PresentationCard] : [])
}

function monthlyPrice(server: CfsmServer): string | null {
  const amount = Number(server.price)
  if (!Number.isFinite(amount) || amount < 0) return null
  const months: Record<string, number> = { month: 1, quarter: 3, half_year: 6, year: 12, two_years: 24, three_years: 36, four_years: 48, five_years: 60 }
  const divisor = months[server.billingCycle ?? '']
  if (!divisor) return null
  return `${server.currency ?? ''}${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(amount / divisor)} / month`
}

export function buildDetailCards(server: CfsmServer, settings: ThemeSettings, now = Date.now()): PresentationCard[] {
  const percent = (used: number | null, total: number | null) => used !== null && total !== null && total > 0 ? Math.min(100, Math.max(0, used / total * 100)) : null
  const totalTraffic = server.networkReceived === null && server.networkTransmitted === null ? null : (server.networkReceived ?? 0) + (server.networkTransmitted ?? 0)
  const gpu = average(server.gpus.map((item) => item.utilization))
  const days = daysUntilExpiry(server.expireDate, now)
  const quotaLimit = parseTrafficLimitBytes(server.trafficLimit)
  const rx = server.monthlyNetworkReceived
  const tx = server.monthlyNetworkTransmitted
  const calculation = server.trafficCalculationType?.toLowerCase()
  const quotaUsed = rx === null && tx === null ? null
    : calculation === 'dl' ? rx
      : calculation === 'ul' ? tx
        : calculation === 'max' ? Math.max(rx ?? 0, tx ?? 0)
          : (rx ?? 0) + (tx ?? 0)
  const monthly = monthlyPrice(server)
  const model: Record<DetailCardKey, PresentationCard | null> = {
    nodePrice: server.price === null ? null : { key: 'nodePrice', icon: 'tabler:cash', label: '节点价格', value: formatPrice(server.price, server.currency, server.billingCycle), hint: 'CFSM 套餐字段' },
    monthlyCost: monthly === null ? null : { key: 'monthlyCost', icon: 'tabler:receipt-2', label: '月均支出', value: monthly, hint: '按账期等分，不做汇率换算' },
    remainingTime: days === null ? null : { key: 'remainingTime', icon: 'tabler:hourglass', label: '剩余时间', value: days < 0 ? `已过期 ${Math.abs(days)} 天` : `${days} 天`, hint: server.expireDate ?? '' },
    cpuUsage: server.cpu === null ? null : { key: 'cpuUsage', icon: 'tabler:cpu', label: 'CPU', value: formatPercent(server.cpu), hint: `Load ${formatLoad(server.load1)} / ${formatLoad(server.load5)} / ${formatLoad(server.load15)}`, percentage: server.cpu },
    gpuUsage: gpu === null ? null : { key: 'gpuUsage', icon: 'tabler:cpu-2', label: 'GPU', value: formatPercent(gpu), hint: `${server.gpus.length} 个设备`, percentage: gpu },
    memoryUsage: percent(server.memoryUsed, server.memoryTotal) === null ? null : { key: 'memoryUsage', icon: 'icon-park-outline:memory', label: 'RAM', value: formatPercent(percent(server.memoryUsed, server.memoryTotal)), hint: `${formatBytes(server.memoryUsed === null ? null : server.memoryUsed * 1024 ** 2)} / ${formatBytes(server.memoryTotal === null ? null : server.memoryTotal * 1024 ** 2)}`, percentage: percent(server.memoryUsed, server.memoryTotal) },
    swapUsage: percent(server.swapUsed, server.swapTotal) === null ? null : { key: 'swapUsage', icon: 'icon-park-outline:switch', label: 'Swap', value: formatPercent(percent(server.swapUsed, server.swapTotal)), hint: '真实使用比例', percentage: percent(server.swapUsed, server.swapTotal) },
    diskUsage: percent(server.diskUsed, server.diskTotal) === null ? null : { key: 'diskUsage', icon: 'tabler:server-2', label: 'Disk', value: formatPercent(percent(server.diskUsed, server.diskTotal)), hint: '真实使用比例', percentage: percent(server.diskUsed, server.diskTotal) },
    load: server.load1 === null ? null : { key: 'load', icon: 'tabler:gauge', label: '系统负载', value: formatLoad(server.load1), hint: `${formatLoad(server.load5)} / ${formatLoad(server.load15)}` },
    processes: server.processes === null ? null : { key: 'processes', icon: 'tabler:list-numbers', label: '进程', value: formatCount(server.processes), hint: '当前上报值' },
    connections: server.tcpConnections === null && server.udpConnections === null ? null : { key: 'connections', icon: 'tabler:activity', label: '连接', value: formatCount((server.tcpConnections ?? 0) + (server.udpConnections ?? 0)), hint: `TCP ${formatCount(server.tcpConnections)} · UDP ${formatCount(server.udpConnections)}` },
    uptime: server.bootTime === null ? null : { key: 'uptime', icon: 'tabler:clock', label: '运行时间', value: formatUptime(server.bootTime, now), hint: '根据 boot_time 计算' },
    uploadSpeed: server.networkOutSpeed === null ? null : { key: 'uploadSpeed', icon: 'tabler:arrow-big-up-lines', label: '实时上传', value: formatSpeed(server.networkOutSpeed), hint: '当前节点' },
    downloadSpeed: server.networkInSpeed === null ? null : { key: 'downloadSpeed', icon: 'tabler:arrow-big-down-lines', label: '实时下载', value: formatSpeed(server.networkInSpeed), hint: '当前节点' },
    totalTraffic: totalTraffic === null ? null : { key: 'totalTraffic', icon: 'tabler:chart-histogram', label: '累计流量', value: formatBytes(totalTraffic), hint: '接收 + 发送' },
    trafficQuota: quotaLimit === null || quotaUsed === null ? null : { key: 'trafficQuota', icon: 'tabler:alert-triangle', label: '流量配额', value: formatPercent(quotaUsed / quotaLimit * 100), hint: `${formatBytes(quotaUsed)} / ${formatBytes(quotaLimit)}`, percentage: quotaUsed / quotaLimit * 100 },
  }
  return resolveDetailCardKeys(settings).flatMap((key) => model[key] ? [model[key] as PresentationCard] : [])
}

export function filterChartsBySettings(metric: DetailChartModel[], probes: DetailChartModel[], settings: ThemeSettings): DetailChartModel[] {
  const families = new Set(resolveChartFamilies(settings))
  const metricFamily: Record<string, ChartFamily> = { cpu: 'cpu', load: 'cpu', memory: 'memory', disk: 'disk', 'disk-io': 'disk', 'network-speed': 'network', traffic: 'traffic', gpu: 'gpu' }
  return [
    ...metric.filter((chart) => families.has(metricFamily[chart.key] ?? 'cpu') && (chart.key !== 'gpu' || settings.gpuChartEnabled)),
    ...probes.filter((chart) => chart.key === 'ping' ? families.has('ping') : families.has('pingLoss')),
  ]
}
