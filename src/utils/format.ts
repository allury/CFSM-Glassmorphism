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

export function formatPrice(
  price: string | null,
  currency: string | null,
  billingCycle: string | null,
): string {
  if (price === null) return '—'
  const amount = Number(price)
  if (!Number.isFinite(amount)) return '—'
  if (amount === 0 || amount === -1) return '免费'
  if (amount < 0) return '—'
  const formatted = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(amount)
  const prefix = currency?.trim() ?? ''
  const cycle = billingCycle?.trim()
  return `${prefix}${formatted}${cycle ? ` / ${cycle}` : ''}`
}
