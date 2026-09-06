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

export function formatLatency(value: number | null): string {
  const latency = normalizedNumber(value)
  return latency === null ? '—' : latency.toFixed(latency >= 100 ? 0 : 1) + ' ms'
}
