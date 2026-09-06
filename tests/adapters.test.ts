import { describe, expect, it } from 'vitest'
import {
  normalizeHistory,
  normalizeServer,
  normalizeServerCollection,
  normalizeSiteConfig,
} from '@/services/cfsm/adapters'
import { apiSource } from '@/services/cfsm/config'

const source = apiSource('https://status.example')

describe('CFSM wire adapters', () => {
  it('normalizes the public config contract without trusting unknown fields', () => {
    const config = normalizeSiteConfig({
      version: '2.8.5 Beta3',
      is_public: 1,
      authorization: true,
      turnstile_enabled: '1',
      custom_ct_name: 'Telecom',
      site_title: 'Status',
      preferred_theme: 'dark',
      default_language: 'zh',
      theme_options: { glass: true },
      frontend_ws_timeout_minutes: '20',
      long_history_points: 180,
      latency_window: { points: 20, hours: 2 },
    })

    expect(config).toMatchObject({
      version: '2.8.5 Beta3',
      isPublic: true,
      turnstileEnabled: true,
      siteTitle: 'Status',
      preferredTheme: 'dark',
      defaultLanguage: 'zh',
      frontendWebsocketTimeoutMinutes: 20,
      longHistoryPoints: 180,
    })
    expect(config.latencyLabels.ct).toBe('Telecom')
    expect(config.themeOptions).toEqual({ glass: true })
  })

  it('maps official server fields, reachability flags and optional metrics', () => {
    const server = normalizeServer({
      id: 'node-1',
      name: 'Hong Kong',
      server_group: 'edge',
      tags: 'prod, edge,prod',
      price: '30.00',
      cpu: '12.5',
      load_avg: '0.10 0.20 0.30',
      ram_total: 8192,
      ram_used: 4096,
      ip_v4: '1',
      ip_v6: '0',
      last_updated: 1_000_000,
      gpu_info: '[{"id":"0","name":"RTX","info":13}]',
      disk: {
        read_bps: 4096,
        write_bps: 2048,
        read_iops: 12,
        write_iops: 8,
        await_ms: 1.5,
        util: 3.2,
      },
      ping: [{ ts: 999_000, ct: 20, cu: false, cm: null, bd: 30 }],
      loss: [],
    }, source, 1_120_000)

    expect(server.online).toBe(true)
    expect(server.tags).toEqual(['prod', 'edge'])
    expect(server.load5).toBe(0.2)
    expect(server.ipV4Reachable).toBe('1')
    expect(server.ipV6Reachable).toBe('0')
    expect(server.gpus).toEqual([{ id: '0', name: 'RTX', utilization: 13 }])
    expect(server.diskIo?.readBps).toBe(4096)
    expect(server.latencyWindow[0]).toEqual({
      timestamp: 999_000,
      ct: 20,
      cu: null,
      cm: null,
      bd: 30,
    })
  })

  it('does not expose absent all-zero disk IO or stale online state', () => {
    const server = normalizeServer({
      id: 'node-2',
      last_updated: 1_000,
      disk: {
        read_bps: 0,
        write_bps: 0,
        read_iops: 0,
        write_iops: 0,
        await_ms: 0,
        util: 0,
      },
    }, source, 400_001)

    expect(server.online).toBe(false)
    expect(server.diskIo).toBeUndefined()
    expect(server.gpus).toEqual([])
    expect(server.ipV4Reachable).toBeNull()
  })

  it('keeps source ownership on list responses', () => {
    const result = normalizeServerCollection({
      servers: [{ id: 'node-1' }],
      stats: { online: 1 },
      sysConfig: { show_price: true, long_history_points: 180 },
    }, source)

    expect(result.servers[0]?.source.base).toBe('https://status.example')
    expect(result.stats).toEqual({ online: 1 })
    expect(result.systemConfig).toEqual({ showPrice: true, longHistoryPoints: 180 })
  })

  it('normalizes history and legacy flat disk IO without inventing rows', () => {
    const history = normalizeHistory([
      {
        timestamp: 123,
        cpu: 4,
        disk_read_bps: 100,
        disk_write_bps: 20,
      },
      null,
      { cpu: 9 },
    ])

    expect(history).toHaveLength(1)
    expect(history[0]?.timestamp).toBe(123)
    expect(history[0]?.diskIo?.readBps).toBe(100)
  })

  it('rejects malformed required response shapes', () => {
    expect(() => normalizeSiteConfig([])).toThrow('Config response must be an object')
    expect(() => normalizeServer({ name: 'missing id' }, source)).toThrow(
      'Server response is missing a valid id',
    )
    expect(() => normalizeServerCollection({ servers: null }, source)).toThrow(
      'Servers response is missing the servers array',
    )
  })
})
