import { describe, expect, it } from 'vitest'
import {
  normalizeServer,
  normalizeSiteConfig,
  toGlassServer,
} from '@/services/cfsm'
import { apiSource } from '@/services/cfsm/config'

const source = apiSource('https://status.example')

describe('Server to Glassmorphism adapter', () => {
  it('maps real CFSM metrics and custom latency labels into the view model', () => {
    const config = normalizeSiteConfig({
      site_title: 'Production',
      custom_ct_name: '电信',
      custom_cu_name: '联通',
      custom_cm_name: '移动',
      custom_bd_name: 'BGP',
    })
    const server = normalizeServer({
      id: 'node-1',
      name: 'HK Edge',
      server_group: 'Edge',
      tags: 'prod,cn',
      region: 'HK',
      cpu: 23.4,
      load_avg: '0.2 0.3 0.4',
      ram_used: 2048,
      ram_total: 8192,
      swap_used: 0,
      swap_total: 1024,
      disk_used: 40,
      disk_total: 100,
      net_in_speed: 1024,
      net_out_speed: 2048,
      net_rx: 10_000,
      net_tx: 20_000,
      net_rx_monthly: 30_000,
      net_tx_monthly: 40_000,
      processes: 92,
      tcp_conn: 12,
      udp_conn: 3,
      ping_ct: 21,
      loss_ct: 0,
      ping_cu: false,
      loss_cu: null,
      gpu_info: [{ id: '0', name: 'GPU 0', info: 45 }],
      ip_v4: '1',
      ip_v6: '0',
      cpu_cores: 4,
      kernel_version: '6.8.0',
      agent_version: '1.3.3',
      boot_time: 1_700_000_000_000,
      is_online: '1',
    }, source)

    const view = toGlassServer(server, config)

    expect(view).toMatchObject({
      id: 'node-1',
      name: 'HK Edge',
      group: 'Edge',
      region: 'HK',
      online: true,
      cpu: 23.4,
      memory: { used: 2048, total: 8192, percentage: 25 },
      swap: { used: 0, total: 1024, percentage: 0 },
      disk: { used: 40, total: 100, percentage: 40 },
      network: {
        inSpeed: 1024,
        outSpeed: 2048,
        received: 10_000,
        transmitted: 20_000,
        monthlyReceived: 30_000,
        monthlyTransmitted: 40_000,
      },
      connectivity: { ipv4: '1', ipv6: '0' },
      cpuCores: 4,
      kernelVersion: '6.8.0',
      agentVersion: '1.3.3',
      bootTime: 1_700_000_000_000,
    })
    expect(view.latency).toEqual([
      {
        carrier: 'ct',
        label: '电信',
        latency: 21,
        packetLoss: 0,
      },
      {
        carrier: 'cu',
        label: '联通',
        latency: false,
        packetLoss: null,
      },
    ])
    expect(view.gpus).toEqual([{ id: '0', name: 'GPU 0', utilization: 45 }])
  })

  it('keeps reachability as state and never creates IP address fields', () => {
    const view = toGlassServer(normalizeServer({
      id: 'node-2',
      ip_v4: '1',
      ip_v6: '0',
    }, source), null)

    expect(view.connectivity).toEqual({ ipv4: '1', ipv6: '0' })
    expect(Object.keys(view)).not.toContain('ipv4')
    expect(Object.keys(view)).not.toContain('ipv6')
    expect(JSON.stringify(view)).not.toContain('127.0.0.1')
  })

  it('turns invalid and missing old-agent metrics into unavailable values', () => {
    const view = toGlassServer(normalizeServer({
      id: 'old-node',
      cpu: 'NaN',
      ram_used: -1,
      ram_total: null,
      load_avg: '',
      net_in_speed: 'invalid',
      gpu_info: 'not-json',
      is_online: '0',
    }, source), null)

    expect(view.online).toBe(false)
    expect(view.cpu).toBeNull()
    expect(view.memory).toEqual({ used: null, total: null, percentage: null })
    expect(view.load).toEqual({ one: null, five: null, fifteen: null })
    expect(view.network.inSpeed).toBeNull()
    expect(view.gpus).toEqual([])
    expect(view.latency).toEqual([])
  })

  it('uses the same centralized legacy labels when config is unavailable', () => {
    const view = toGlassServer(normalizeServer({
      id: 'fallback-label-node',
      ping_ct: 0,
      loss_ct: 0,
    }, source), null)

    expect(view.latency).toEqual([{
      carrier: 'ct',
      label: '电信',
      latency: 0,
      packetLoss: 0,
    }])
  })
})
