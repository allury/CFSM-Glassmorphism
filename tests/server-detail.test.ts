import { describe, expect, it } from 'vitest'
import { DEFAULT_PROBE_LABELS } from '@/constants/probes'
import { probeSeries } from '@/domain/detail-chart-options'
import {
  activeProbeTargets,
  buildChartRows,
  labeledProbeTargets,
  probeStats,
} from '@/domain/server-detail'
import { normalizeHistory, normalizeServer } from '@/services/cfsm/adapters'

const source = { base: 'https://status.example', label: 'status.example' }
const START = 1_700_000_000_000
const MINUTE = 60_000

function cpuHistory(offsets: number[]) {
  return normalizeHistory(offsets.map((offset, index) => ({ timestamp: START + offset, cpu: index })))
}

describe('history normalization', () => {
  it('maps processes and TCP / UDP connections from /api/history/all', () => {
    const [point] = normalizeHistory([{ timestamp: START, processes: 88, tcp_conn: 12, udp_conn: 0 }])
    expect(point).toMatchObject({ processes: 88, tcpConnections: 12, udpConnections: 0 })
  })

  it('keeps absent columns as null instead of 0', () => {
    const [point] = normalizeHistory([{ timestamp: START }])
    expect(point).toMatchObject({ processes: null, tcpConnections: null, udpConnections: null })
  })
})

describe('chart rows', () => {
  it('sorts real samples and adds nothing when the spacing is regular', () => {
    const rows = buildChartRows(cpuHistory([2 * MINUTE, 0, MINUTE, 3 * MINUTE]))
    expect(rows.map((row) => row.timestamp)).toEqual([0, 1, 2, 3].map((step) => START + step * MINUTE))
    expect(rows.map((row) => row.point?.cpu)).toEqual([1, 2, 0, 3])
  })

  it('breaks the line across an offline gap with value-less markers only', () => {
    const rows = buildChartRows(cpuHistory([0, MINUTE, 2 * MINUTE, 3 * MINUTE, 13 * MINUTE, 14 * MINUTE]))
    const markers = rows.filter((row) => row.point === null)
    expect(markers).toHaveLength(9)
    for (const marker of markers) {
      expect(marker.timestamp).toBeGreaterThan(START + 3 * MINUTE)
      expect(marker.timestamp).toBeLessThan(START + 13 * MINUTE)
    }
    expect(rows.filter((row) => row.point !== null).map((row) => row.point?.cpu)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('does not treat jitter below twice the sampling interval as a gap', () => {
    const rows = buildChartRows(cpuHistory([0, MINUTE, 2 * MINUTE, 3 * MINUTE + 50_000]))
    expect(rows.every((row) => row.point !== null)).toBe(true)
  })

  it('caps the markers for an extremely long gap but still breaks the line', () => {
    const rows = buildChartRows(cpuHistory([0, MINUTE, 2 * MINUTE, 2 * MINUTE + 30 * 24 * 60 * MINUTE]))
    expect(rows.filter((row) => row.point === null)).toHaveLength(1500)
  })

  it('leaves fewer than three samples untouched', () => {
    expect(buildChartRows(cpuHistory([0, 90 * MINUTE]))).toHaveLength(2)
  })
})

describe('probe statistics', () => {
  it('computes latency statistics from numeric samples only', () => {
    const points = normalizeHistory([
      { timestamp: START, ping_ct: 10, loss_ct: 0 },
      { timestamp: START + MINUTE, ping_ct: null, loss_ct: null },
      { timestamp: START + 2 * MINUTE, ping_ct: 30, loss_ct: 4 },
      { timestamp: START + 3 * MINUTE, ping_ct: false, loss_ct: false },
      { timestamp: START + 4 * MINUTE, ping_ct: 20, loss_ct: 2 },
    ])
    const stats = probeStats(points, 'ct')
    // 超时计入总数但不参与数值统计，未配置两者都不计；丢包 0 是有效值。
    expect(stats).toMatchObject({ total: 4, valid: 3, avg: 20, min: 10, max: 30, latest: 20, p50: 20, p99: 30, loss: 2 })
    expect(stats.ratio).toBeCloseTo(1.5)
    expect(stats.stddev).toBeCloseTo(Math.sqrt(200 / 3))
  })

  it('reports no loss rather than 0 when the loss column has no numeric sample', () => {
    const points = normalizeHistory([{ timestamp: START, ping_cu: 12, loss_cu: null }])
    expect(probeStats(points, 'cu')).toMatchObject({ avg: 12, loss: null })
  })
})

describe('probe targets', () => {
  it('preserves false, null, zero and numbers for legacy and Node probe history', () => {
    const points = normalizeHistory([
      { timestamp: 1, ping_ct: false, loss_ct: null, ping_node_1: null, loss_node_1: 0 },
      { timestamp: 2, ping_ct: 18, loss_ct: 0, ping_node_1: 0, loss_node_1: 2 },
    ])
    expect(points.map((point) => point.latency.ct)).toEqual([false, 18])
    expect(points.map((point) => point.latency.node_1)).toEqual([null, 0])
    expect(points.map((point) => point.packetLoss.ct)).toEqual([null, 0])

    const rows = buildChartRows(points)
    const [telecom] = probeSeries(rows, [{ target: 'ct', label: 'Telecom' }], 'latency', ['#FF6B6B'], false)
    expect(telecom?.data.map(([, value]) => value)).toEqual([null, 18])
    const [tokyo] = probeSeries(rows, [{ target: 'node_1', label: 'Tokyo probe' }], 'latency', ['#FF6B6B'], false)
    expect(tokyo?.name).toBe('Tokyo probe')
    expect(tokyo?.data.map(([, value]) => value)).toEqual([null, 0])
  })

  it('hides non-numeric trends while retaining timeout-only probes in current detail state', () => {
    const points = normalizeHistory([{ timestamp: 1, ping_node_2: null, loss_node_2: false }])
    const server = normalizeServer({ id: 'node-a' }, source)

    expect(probeSeries(buildChartRows(points), [{ target: 'node_2', label: 'Node 2' }], 'latency', ['#FF6B6B'], false)).toEqual([])
    expect(activeProbeTargets(server, points)).toContain('node_2')
  })

  it('disambiguates duplicate probe labels so legend toggles stay independent', () => {
    const labels = { ...DEFAULT_PROBE_LABELS, node_1: 'Tokyo', node_2: 'Tokyo' }
    expect(labeledProbeTargets(['ct', 'node_1', 'node_2'], labels)).toEqual([
      { target: 'ct', label: DEFAULT_PROBE_LABELS.ct },
      { target: 'node_1', label: 'Tokyo (node_1)' },
      { target: 'node_2', label: 'Tokyo (node_2)' },
    ])
  })
})
