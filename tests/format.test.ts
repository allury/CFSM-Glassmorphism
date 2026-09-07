import { describe, expect, it } from 'vitest'
import {
  formatLatency,
  formatProbePercent,
  formatTimestamp,
  formatUptime,
} from '@/utils/format'

describe('time formatting', () => {
  it('supports CFSM boot timestamps in seconds and milliseconds', () => {
    expect(formatUptime(1_700_000_000, 1_700_093_780_000)).toBe('1 天 2 小时')
    expect(formatUptime(1_700_000_000_000, 1_700_003_780_000)).toBe('1 小时 3 分')
  })

  it('keeps missing, zero and future timestamps unavailable', () => {
    expect(formatUptime(null)).toBe('—')
    expect(formatUptime(0)).toBe('—')
    expect(formatUptime(Date.now() + 60_000)).toBe('—')
    expect(formatTimestamp(null)).toBe('—')
  })

  it('renders probe timeout, absence and zero as distinct states', () => {
    expect(formatLatency(null)).toBe('超时')
    expect(formatLatency(false)).toBe('—')
    expect(formatLatency(0)).toBe('0.0 ms')
    expect(formatProbePercent(null)).toBe('超时')
    expect(formatProbePercent(false)).toBe('—')
    expect(formatProbePercent(0)).toBe('0.0%')
  })
})
