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

function timestampMilliseconds(value: number | null): number | null {
  const timestamp = normalizedNumber(value)
  if (timestamp === null || timestamp === 0) return null
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
}

export function formatTimestamp(value: number | null): string {
  const timestamp = timestampMilliseconds(value)
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
  const startedAt = timestampMilliseconds(bootTime)
  if (startedAt === null || startedAt > now) return '—'
  const totalMinutes = Math.floor((now - startedAt) / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${minutes} 分钟`
}
