import { describe, expect, it } from 'vitest'
import {
  activeProbeTargets,
  buildMetricHistoryCharts,
  buildProbeHistoryCharts,
} from '@/domain/server-detail'
import { normalizeHistory, normalizeServer } from '@/services/cfsm/adapters'

const source = { base: 'https://status.example', label: 'status.example' }

describe('server detail history models', () => {
  it('builds only real metric, GPU and Disk IO series without inserting points', () => {
    const points = normalizeHistory([
      {
        timestamp: 1_700_000_060,
        cpu: 0,
        ram_used: 512,
        ram_total: 1024,
        gpu_info: '[{"id":"0","name":"GPU 0","info":0}]',
        disk: { read_bps: 20, write_bps: 0 },
      },
      {
        timestamp: 1_700_000_000,
        cpu: 30,
        ram_used: 256,
        ram_total: 1024,
        gpu_info: [{ id: '0', name: 'GPU 0', info: 42 }],
        disk: { read_bps: 10, write_bps: 5 },
      },
    ])

    const charts = buildMetricHistoryCharts(points)
    const cpu = charts.find((item) => item.key === 'cpu')
    const gpu = charts.find((item) => item.key === 'gpu')
    const diskIo = charts.find((item) => item.key === 'disk-io')

    expect(cpu?.series[0]?.points.map((point) => point.value)).toEqual([30, 0])
    expect(cpu?.series[0]?.points).toHaveLength(2)
    expect(gpu?.series[0]?.points.map((point) => point.value)).toEqual([42, 0])
    expect(diskIo?.series.map((item) => item.label)).toEqual(['读取', '写入'])
    expect(charts.some((item) => item.key === 'traffic')).toBe(false)
  })

  it('preserves false, null, zero and numbers for legacy and Node probe history', () => {
    const points = normalizeHistory([
      {
        timestamp: 1,
        ping_ct: false,
        loss_ct: null,
        ping_node_1: null,
        loss_node_1: 0,
      },
      {
        timestamp: 2,
        ping_ct: 18,
        loss_ct: 0,
        ping_node_1: 0,
        loss_node_1: 2,
      },
    ])
    const labels = {
      ct: 'Telecom',
      cu: 'Unicom',
      cm: 'Mobile',
      bd: 'BGP',
      node_1: 'Tokyo probe',
      node_2: 'Node 2',
      node_3: 'Node 3',
      node_4: 'Node 4',
    }
    const charts = buildProbeHistoryCharts(points, labels)
    const ping = charts.find((item) => item.key === 'ping')
    const loss = charts.find((item) => item.key === 'loss')

    expect(ping?.series.find((item) => item.key === 'ping-ct')?.points.map((point) => point.value))
      .toEqual([false, 18])
    expect(ping?.series.find((item) => item.key === 'ping-node_1')).toMatchObject({
      label: 'Tokyo probe',
      points: [{ value: null }, { value: 0 }],
    })
    expect(loss?.series.find((item) => item.key === 'loss-ct')?.points.map((point) => point.value))
      .toEqual([null, 0])
  })

  it('hides non-numeric trends while retaining timeout-only probes in current detail state', () => {
    const points = normalizeHistory([{
      timestamp: 1,
      ping_node_2: null,
      loss_node_2: false,
    }])
    const server = normalizeServer({ id: 'node-a' }, source)

    expect(buildProbeHistoryCharts(points)).toEqual([])
    expect(activeProbeTargets(server, points)).toContain('node_2')
  })
})
