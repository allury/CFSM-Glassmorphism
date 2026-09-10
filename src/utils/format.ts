import type { ProbeValue } from '@/types/cfsm'

const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const

function normalizedNumber(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null
}
export function formatBytes(value: number | null, suffix = ''): string {
  const bytes = normalizedNumber(value)
  if (bytes === null) return '—'
  if (bytes === 0) return '0 B' + suffix

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  )
  const scaled = bytes / (1024 ** unitIndex)
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  return scaled.toFixed(digits) + ' ' + BYTE_UNITS[unitIndex] + suffix
}

export function formatMebibytes(value: number | null): string {
  const mebibytes = normalizedNumber(value)
  return mebibytes === null ? '—' : formatBytes(mebibytes * 1024 * 1024)
}

export function formatSpeed(value: number | null): string {
  return formatBytes(value, '/s')
}

export function formatPercent(value: number | null): string {
  const percentage = normalizedNumber(value)
  return percentage === null ? '—' : percentage.toFixed(1) + '%'
}

export function formatLoad(value: number | null): string {
  const load = normalizedNumber(value)
  return load === null ? '—' : load.toFixed(2)
}

export function formatCount(value: number | null): string {
  const count = normalizedNumber(value)
  return count === null ? '—' : Math.round(count).toLocaleString('zh-CN')
}

export function formatLatency(value: ProbeValue): string {
  if (value === null) return '超时'
  if (value === false) return '—'
  const latency = normalizedNumber(value)
  return latency === null ? '—' : latency.toFixed(latency >= 100 ? 0 : 1) + ' ms'
}

export function formatProbePercent(value: ProbeValue): string {
  if (value === null) return '超时'
  if (value === false) return '—'
  return formatPercent(value)
}

export function normalizeTimestampMilliseconds(value: number | null): number | null {
  const timestamp = normalizedNumber(value)
  if (timestamp === null || timestamp === 0) return null
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
}

export function formatTimestamp(value: number | null): string {
  const timestamp = normalizeTimestampMilliseconds(value)
  if (timestamp === null) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatUptime(bootTime: number | null, now = Date.now()): string {
  const startedAt = normalizeTimestampMilliseconds(bootTime)
  if (startedAt === null || startedAt > now) return '—'
  const totalMinutes = Math.floor((now - startedAt) / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${minutes} 分钟`
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/
const NUMERIC_TIMESTAMP_PATTERN = /^\d{10,13}$/

function calendarDate(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const validation = new Date(Date.UTC(year, month - 1, day))
  if (
    validation.getUTCFullYear() !== year
    || validation.getUTCMonth() !== month - 1
    || validation.getUTCDate() !== day
  ) return null
  return { year, month, day }
}

export function parseCfsmDate(value: string | null): Date | null {
  const candidate = value?.trim()
  if (!candidate) return null

  if (NUMERIC_TIMESTAMP_PATTERN.test(candidate)) {
    const timestamp = normalizeTimestampMilliseconds(Number(candidate))
    if (timestamp === null) return null
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const dateOnly = calendarDate(candidate)
  if (dateOnly) {
    return new Date(Date.UTC(dateOnly.year, dateOnly.month - 1, dateOnly.day, 12))
  }

  if (!ISO_DATE_TIME_PATTERN.test(candidate)) return null
  if (calendarDate(candidate.slice(0, 10)) === null) return null
  const timestamp = Date.parse(candidate)
  return Number.isNaN(timestamp) ? null : new Date(timestamp)
}

export function formatCfsmDate(value: string | null): string {
  const dateOnly = value ? calendarDate(value.trim()) : null
  if (dateOnly) {
    return `${dateOnly.year}/${String(dateOnly.month).padStart(2, '0')}/${String(dateOnly.day).padStart(2, '0')}`
  }
  const date = parseCfsmDate(value)
  if (date === null) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function priceWithCycleLabel(
  price: string | null,
  currency: string | null,
  cycleLabel: string,
): string {
  const normalizedPrice = price?.trim()
  if (!normalizedPrice) return '—'
  const amount = Number(normalizedPrice)
  if (!Number.isFinite(amount)) return '—'
  if (amount === 0 || amount === -1) return '免费'
  if (amount < 0) return '—'
  const formatted = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(amount)
  const prefix = currency?.trim() ?? ''
  return `${prefix}${formatted}${cycleLabel ? ` / ${cycleLabel}` : ''}`
}

export function formatPrice(
  price: string | null,
  currency: string | null,
  billingCycle: string | null,
): string {
  return priceWithCycleLabel(price, currency, billingCycle?.trim() ?? '')
}

export function formatCurrencyValue(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return '—'
  const formatted = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
  return `${currency?.trim() ?? ''}${formatted}`
}

/*
 * ===== 首页显示格式 =====
 *
 * Komari 首页用的是 KB / MB / GB / TB（换算基数仍是 1024），
 * 精度 B 0、KB 0、MB 1、GB 1、TB 2，速度在单位后加 `/s`；
 * 节点卡片的运行时间只显示整天数，计费周期显示为中文。
 *
 * 这一组函数只服务首页总览卡片、节点卡片与节点列表。详情页结构与格式已冻结，
 * 继续使用上面的 `formatBytes` / `formatUptime` / `formatPrice`，
 * 所以这里另起一组显示函数，而不是就地改写既有格式化器。
 * normalized data model 不受影响：改动只发生在展示层。
 */

const HOME_BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const
const HOME_BYTE_DECIMALS: Readonly<Record<string, number>> = {
  B: 0,
  KB: 0,
  MB: 1,
  GB: 1,
  TB: 2,
  PB: 2,
}

/** 数值与单位分离，对应 Komari `formatBytesSplit`；总览卡片的 value / unit 两段就来自它。 */
export interface SplitAmount {
  readonly value: string
  readonly unit: string
}

export function formatHomeBytesSplit(value: number | null): SplitAmount {
  const bytes = normalizedNumber(value)
  if (bytes === null) return { value: '—', unit: '' }
  if (bytes === 0) return { value: '0', unit: 'B' }

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    HOME_BYTE_UNITS.length - 1,
  )
  const unit = HOME_BYTE_UNITS[unitIndex] ?? 'PB'
  return { value: (bytes / 1024 ** unitIndex).toFixed(HOME_BYTE_DECIMALS[unit] ?? 1), unit }
}

export function formatHomeSpeedSplit(value: number | null): SplitAmount {
  const split = formatHomeBytesSplit(value)
  return split.unit === '' ? split : { value: split.value, unit: `${split.unit}/s` }
}

function joinSplit(split: SplitAmount): string {
  return split.unit === '' ? split.value : `${split.value} ${split.unit}`
}

export function formatHomeBytes(value: number | null): string {
  return joinSplit(formatHomeBytesSplit(value))
}

export function formatHomeSpeed(value: number | null): string {
  return joinSplit(formatHomeSpeedSplit(value))
}

/** CFSM 的内存 / 硬盘用量以 MiB 上报，首页仍按 Komari 的显示规则渲染。 */
export function formatHomeMebibytesSplit(value: number | null): SplitAmount {
  const mebibytes = normalizedNumber(value)
  return mebibytes === null
    ? { value: '—', unit: '' }
    : formatHomeBytesSplit(mebibytes * 1024 * 1024)
}

export function formatHomeMebibytes(value: number | null): string {
  return joinSplit(formatHomeMebibytesSplit(value))
}

/** Komari NodeCard 的运行时间只显示整天数（`在线 N 天`），不显示小时。 */
export function formatHomeUptimeDays(bootTime: number | null, now = Date.now()): string {
  const startedAt = normalizeTimestampMilliseconds(bootTime)
  if (startedAt === null || startedAt > now) return '—'
  return `在线 ${Math.floor((now - startedAt) / 86_400_000)} 天`
}

/*
 * CFSM 的 `billing_cycle` 是自由文本。官方枚举值可以安全本地化；
 * 其它取值原样保留，不猜测它代表哪个周期。
 */
const HOME_BILLING_CYCLE_LABELS: Readonly<Record<string, string>> = {
  month: '月',
  quarter: '季',
  half_year: '半年',
  year: '年',
  two_years: '两年',
  three_years: '三年',
  four_years: '四年',
  five_years: '五年',
}

export function formatHomeBillingCycle(billingCycle: string | null): string {
  const cycle = billingCycle?.trim()
  if (!cycle) return ''
  return HOME_BILLING_CYCLE_LABELS[cycle.toLowerCase()] ?? cycle
}

export function formatHomePrice(
  price: string | null,
  currency: string | null,
  billingCycle: string | null,
): string {
  return priceWithCycleLabel(price, currency, formatHomeBillingCycle(billingCycle))
}
