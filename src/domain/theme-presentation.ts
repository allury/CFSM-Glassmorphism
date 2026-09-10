import type { IconName } from '@/constants/icons'
import type { DetailChartModel } from '@/domain/server-detail'
import { parseSettingKeys, type ThemeSettings } from '@/theme/settings'
import type { CfsmServer } from '@/types/cfsm'
import type { GlassServer } from '@/types/glassmorphism'
import {
  formatBytes,
  formatCount,
  formatHomeBytes,
  formatHomeBytesSplit,
  formatHomeMebibytesSplit,
  formatHomeSpeed,
  formatHomeSpeedSplit,
  formatLoad,
  formatPercent,
  formatPrice,
  formatSpeed,
  formatUptime,
  parseCfsmDate,
} from '@/utils/format'

/*
 * 总览卡片的 key 与顺序取自 Komari `stores/app.ts` 的 `ALL_GENERAL_CARD_KEYS`，
 * 只保留 CFSM 能够真实计算的项目。上游的 remainingValue / monthlyCost / yearlyCost
 * 需要跨币种换算，trafficQuota 需要站点级配额，*PeakNode 与 virtualizationDistribution
 * 需要 CFSM 未提供的字段——它们一律不出现，而不是用估算值凑满六张卡。
 */
export type GeneralCardKey =
  | 'currentTime' | 'memory' | 'disk'
  | 'totalTraffic' | 'uploadSpeed' | 'downloadSpeed'
  | 'onlineNodes' | 'offlineNodes' | 'avgCpu' | 'avgGpu' | 'avgLoad'
  | 'swap' | 'processes' | 'connections' | 'cpuCores' | 'gpuNodes'
  | 'trafficPeak' | 'highLoadNodes' | 'expiringNodes' | 'trafficWarnings'
  | 'regionDistribution' | 'systemDistribution'

export type QuickControlKey = 'favorite' | 'totalTraffic' | 'upload' | 'download' | 'peak' | 'offline' | 'highLoad' | 'expiring'
export type DetailCardKey =
  | 'nodePrice' | 'monthlyCost' | 'remainingTime' | 'cpuUsage' | 'gpuUsage'
  | 'memoryUsage' | 'swapUsage' | 'diskUsage' | 'load' | 'processes' | 'connections'
  | 'uptime' | 'uploadSpeed' | 'downloadSpeed' | 'totalTraffic' | 'trafficQuota'
export type ChartFamily = 'cpu' | 'memory' | 'disk' | 'network' | 'traffic' | 'gpu' | 'ping' | 'pingLoss'

/** Komari `ALL_GENERAL_CARD_KEYS` 的顺序，去掉 CFSM 无法真实计算的项目。 */
const ALL_GENERAL_CARD_KEYS: readonly GeneralCardKey[] = [
  'currentTime', 'memory', 'disk', 'totalTraffic', 'uploadSpeed', 'downloadSpeed',
  'onlineNodes', 'offlineNodes', 'avgCpu', 'avgGpu', 'avgLoad', 'swap',
  'processes', 'connections', 'cpuCores', 'gpuNodes', 'trafficPeak',
  'highLoadNodes', 'expiringNodes', 'trafficWarnings',
  'regionDistribution', 'systemDistribution',
]

/*
 * 逐项对应 Komari `GENERAL_CARD_PRESETS`（official / basic / ops / resource /
 * finance / traffic / gpu / asset / full / custom），保持同一顺序，
 * 只删去 CFSM 无法真实计算的条目。因此「基础」是 5 张而不是 6 张：
 * 上游第三张是需要跨币种换算的剩余价值总额。
 */
const GENERAL_PRESETS: Record<ThemeSettings['generalCardPreset'], readonly GeneralCardKey[]> = {
  官方: ['currentTime', 'onlineNodes', 'regionDistribution', 'totalTraffic', 'uploadSpeed', 'downloadSpeed'],
  基础: ['memory', 'disk', 'totalTraffic', 'uploadSpeed', 'downloadSpeed'],
  运维: ['onlineNodes', 'offlineNodes', 'highLoadNodes', 'trafficWarnings', 'avgCpu', 'avgLoad'],
  资源: ['avgCpu', 'avgLoad', 'memory', 'disk', 'swap', 'cpuCores'],
  财务: ['expiringNodes', 'totalTraffic'],
  流量: ['totalTraffic', 'uploadSpeed', 'downloadSpeed', 'trafficPeak', 'trafficWarnings'],
  GPU: ['gpuNodes', 'avgGpu', 'avgCpu', 'memory', 'trafficPeak'],
  资产: ['onlineNodes', 'regionDistribution', 'systemDistribution', 'cpuCores', 'gpuNodes'],
  完整: ALL_GENERAL_CARD_KEYS,
  自定义: [],
}

/*
 * 快捷控制预设对应 Komari `HOME_QUICK_CONTROL_PRESETS`，去掉 CFSM 没有的
 * `monthlyCost`（跨币种月费用估算）。上游的「完整」是 7 项，因此 CFSM 是 6 项，
 * 而不是此前把上行/下行也塞进去的 8 项。
 */
const QUICK_PRESETS: Record<ThemeSettings['homeQuickControlPreset'], readonly QuickControlKey[]> = {
  基础: ['favorite', 'peak', 'offline'],
  流量: ['favorite', 'totalTraffic', 'peak'],
  运维: ['favorite', 'offline', 'highLoad', 'expiring'],
  完整: ['favorite', 'totalTraffic', 'peak', 'offline', 'highLoad', 'expiring'],
  自定义: [],
}

/*
 * 允许出现在自定义列表里的全部 key，对应 Komari `ALL_HOME_QUICK_CONTROL_KEYS`
 * （默认顺序 + upload + download）。这一份必须独立于「完整」预设：
 * 上游的默认预设里同样没有 upload / download，但自定义模式仍可选中它们。
 */
const ALL_QUICK_CONTROL_KEYS: readonly QuickControlKey[] = [
  ...QUICK_PRESETS.完整,
  'upload',
  'download',
]

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

const GENERAL_KEYS = new Set<string>(ALL_GENERAL_CARD_KEYS)
const QUICK_KEYS = new Set<string>(ALL_QUICK_CONTROL_KEYS)
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

/**
 * `icon` 使用与 Komari 一致的图标名（见 `@/constants/icons`），由 `AppIcon` 渲染。
 *
 * 总览卡片使用 `value` + `unit`，与上游 `GeneralMetricCard` 的两段式一致：
 * 主数值大字，单位小字并与主数值基线对齐；`hint` 此时是 tooltip 文本。
 * 详情页卡片结构已冻结，仍然把 `hint` 当作可见副文本。
 */
export interface PresentationCard {
  key: string
  icon: IconName
  label: string
  value: string
  hint: string
  unit?: string
  percentage?: number | null
}

/** 取用量最高的一台节点，用于「实时峰值」卡片的 tooltip 说明。 */
function peakSpeedNode(servers: GlassServer[]): { name: string, value: number } | null {
  let best: { name: string, value: number } | null = null
  for (const server of servers) {
    for (const speed of [server.network.inSpeed, server.network.outSpeed]) {
      if (speed === null) continue
      if (best === null || speed > best.value) best = { name: server.name, value: speed }
    }
  }
  return best
}

/** 出现次数最多的取值，对应 Komari `getDistribution` 的首项。 */
function topDistribution(values: Array<string | null>): { label: string, count: number } | null {
  const counters = new Map<string, number>()
  for (const value of values) {
    const label = value?.trim()
    if (!label) continue
    counters.set(label, (counters.get(label) ?? 0) + 1)
  }
  let best: { label: string, count: number } | null = null
  for (const [label, count] of counters) {
    if (best === null || count > best.count) best = { label, count }
  }
  return best
}

/*
 * 总览卡片。value / unit 的拆分方式与 Komari `NodeGeneralCards` 完全一致：
 * 内存与硬盘是「已用数值 + 已用单位 / 总量」，流量与速率是「数值 + 单位」，
 * 计数类是「数值 + / 总数」或「数值 + 台 / 个」。
 * 单位一栏只放真正的单位，不再塞「接收 + 发送」「在线节点合计」这类说明文字，
 * 那些说明改由 tooltip（`hint`）承担，手机端因此不会再被长文本挤到省略。
 */
export function buildGeneralCards(servers: GlassServer[], settings: ThemeSettings, now = Date.now()): PresentationCard[] {
  const online = servers.filter((server) => server.online)
  const offlineCount = servers.length - online.length
  const resources = (selector: (server: GlassServer) => { used: number | null, total: number | null }) => {
    const used = sum(servers.map((server) => selector(server).used))
    const total = sum(servers.map((server) => selector(server).total))
    return { used, total, percentage: used !== null && total !== null && total > 0 ? used / total * 100 : null }
  }
  /** 内存 / 硬盘 / 交换内存：`已用值` + `已用单位 / 总量 单位`。 */
  const usageCard = (
    key: 'memory' | 'disk' | 'swap',
    icon: IconName,
    label: string,
    metric: { used: number | null, total: number | null, percentage: number | null },
  ): PresentationCard | null => {
    if (metric.percentage === null) return null
    const used = formatHomeMebibytesSplit(metric.used)
    const total = formatHomeMebibytesSplit(metric.total)
    return {
      key,
      icon,
      label,
      value: used.value,
      unit: `${used.unit} / ${total.value} ${total.unit}`,
      hint: formatPercent(metric.percentage),
      percentage: metric.percentage,
    }
  }

  const memory = resources((server) => server.memory)
  const disk = resources((server) => server.disk)
  const swap = resources((server) => server.swap)
  const trafficUp = sum(servers.map((server) => server.network.transmitted))
  const trafficDown = sum(servers.map((server) => server.network.received))
  const totalTraffic = trafficUp === null && trafficDown === null ? null : (trafficUp ?? 0) + (trafficDown ?? 0)
  const upload = sum(online.map((server) => server.network.outSpeed))
  const download = sum(online.map((server) => server.network.inSpeed))
  const peak = peakSpeedNode(online)
  const avgCpu = average(online.map((server) => server.cpu))
  const avgGpu = average(online.flatMap((server) => server.gpus.map((gpu) => gpu.utilization)))
  const avgLoad = average(online.map((server) => server.load.one))
  const avgLoad5 = average(online.map((server) => server.load.five))
  const avgLoad15 = average(online.map((server) => server.load.fifteen))
  const processCount = sum(online.map((server) => server.processes))
  const tcpCount = sum(online.map((server) => server.tcpConnections))
  const udpCount = sum(online.map((server) => server.udpConnections))
  const connectionCount = tcpCount === null && udpCount === null ? null : (tcpCount ?? 0) + (udpCount ?? 0)
  const coreCount = sum(servers.map((server) => server.cpuCores))
  const gpuNodeCount = servers.filter((server) => server.gpus.length > 0).length
  const regions = new Set(servers.map((server) => server.region?.trim()).filter(Boolean)).size
  const topSystem = topDistribution(servers.map((server) => server.operatingSystem))
  const highLoadCount = servers.filter((server) => isHighLoad(server, settings.homeHighLoadThreshold)).length
  const expiringCount = servers.filter((server) => isExpiring(server, settings.homeExpiringDays, now)).length
  const trafficWarningCount = servers.filter((server) => isTrafficWarning(server, settings.homeTrafficWarningThreshold)).length
  const totalTrafficSplit = formatHomeBytesSplit(totalTraffic)
  const uploadSplit = formatHomeSpeedSplit(upload)
  const downloadSplit = formatHomeSpeedSplit(download)
  const peakSplit = formatHomeSpeedSplit(peak?.value ?? null)

  const values: Record<GeneralCardKey, PresentationCard | null> = {
    currentTime: { key: 'currentTime', icon: 'tabler:clock', label: '当前时间', value: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now), hint: new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(now) },
    memory: usageCard('memory', 'icon-park-outline:memory', '内存用量', memory),
    disk: usageCard('disk', 'tabler:server-2', '硬盘用量', disk),
    totalTraffic: totalTraffic === null ? null : { key: 'totalTraffic', icon: 'tabler:download', label: '累计流量', value: totalTrafficSplit.value, unit: totalTrafficSplit.unit, hint: `↑ ${formatHomeBytes(trafficUp)}\n↓ ${formatHomeBytes(trafficDown)}` },
    uploadSpeed: upload === null ? null : { key: 'uploadSpeed', icon: 'tabler:chevrons-up', label: '实时上行', value: uploadSplit.value, unit: uploadSplit.unit, hint: '在线节点合计' },
    downloadSpeed: download === null ? null : { key: 'downloadSpeed', icon: 'tabler:chevrons-down', label: '实时下行', value: downloadSplit.value, unit: downloadSplit.unit, hint: '在线节点合计' },
    onlineNodes: { key: 'onlineNodes', icon: 'tabler:activity-heartbeat', label: '在线节点', value: formatCount(online.length), unit: `/ ${formatCount(servers.length)}`, hint: `${offlineCount} 台离线` },
    offlineNodes: { key: 'offlineNodes', icon: 'tabler:plug-connected-x', label: '离线节点', value: formatCount(offlineCount), unit: `/ ${formatCount(servers.length)}`, hint: '五分钟统一判定' },
    avgCpu: avgCpu === null ? null : { key: 'avgCpu', icon: 'tabler:cpu', label: '平均 CPU', value: avgCpu.toFixed(1), unit: '%', hint: '有采样的在线节点' },
    avgGpu: avgGpu === null ? null : { key: 'avgGpu', icon: 'tabler:device-desktop-analytics', label: '平均 GPU', value: avgGpu.toFixed(1), unit: '%', hint: '有 GPU 采样的在线节点' },
    avgLoad: avgLoad === null ? null : { key: 'avgLoad', icon: 'tabler:chart-line', label: '平均负载', value: formatLoad(avgLoad), hint: `1m ${formatLoad(avgLoad)}\n5m ${formatLoad(avgLoad5)}\n15m ${formatLoad(avgLoad15)}` },
    swap: usageCard('swap', 'icon-park-outline:switch', '交换内存', swap),
    processes: processCount === null ? null : { key: 'processes', icon: 'tabler:list-numbers', label: '进程总数', value: formatCount(processCount), hint: '在线节点合计' },
    connections: connectionCount === null ? null : { key: 'connections', icon: 'tabler:plug-connected', label: '连接数', value: formatCount(connectionCount), hint: `TCP ${formatCount(tcpCount)}\nUDP ${formatCount(udpCount)}` },
    // 上游用 `tabler:chip`，该名称已不在 Iconify Tabler 集内，改用同族的 `tabler:cpu`。
    cpuCores: coreCount === null ? null : { key: 'cpuCores', icon: 'tabler:cpu', label: 'CPU 核心', value: formatCount(coreCount), unit: 'Core', hint: '有数据节点合计' },
    gpuNodes: { key: 'gpuNodes', icon: 'tabler:device-imac', label: 'GPU 节点', value: formatCount(gpuNodeCount), unit: `/ ${formatCount(servers.length)}`, hint: '包含真实 gpu_info' },
    trafficPeak: peak === null ? null : { key: 'trafficPeak', icon: 'tabler:activity', label: '实时峰值', value: peakSplit.value, unit: peakSplit.unit, hint: `${peak.name}\n${formatHomeSpeed(peak.value)}` },
    highLoadNodes: { key: 'highLoadNodes', icon: 'tabler:alert-triangle', label: '高负载节点', value: formatCount(highLoadCount), unit: `/ ${formatCount(online.length)}`, hint: `CPU / RAM / Disk ≥ ${settings.homeHighLoadThreshold}%` },
    expiringNodes: { key: 'expiringNodes', icon: 'tabler:calendar-exclamation', label: '即将到期', value: formatCount(expiringCount), unit: '台', hint: `${settings.homeExpiringDays} 天内` },
    trafficWarnings: { key: 'trafficWarnings', icon: 'tabler:traffic-cone', label: '流量预警', value: formatCount(trafficWarningCount), unit: '台', hint: `可靠配额 ≥ ${settings.homeTrafficWarningThreshold}%` },
    regionDistribution: { key: 'regionDistribution', icon: 'tabler:map-pin', label: '地区分布', value: formatCount(regions), unit: '个', hint: '有真实 region 的地区数' },
    systemDistribution: { key: 'systemDistribution', icon: 'tabler:device-desktop', label: '系统分布', value: topSystem?.label ?? '-', unit: topSystem ? `${formatCount(topSystem.count)} 台` : undefined, hint: '有真实 OS 的节点中占比最高的系统' },
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
