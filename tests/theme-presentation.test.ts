import { describe, expect, it } from 'vitest'
import {
  buildDetailCards,
  buildGeneralCards,
  daysUntilExpiry,
  isExpiring,
  isHighLoad,
  isTrafficWarning,
  matchProvider,
  parseProviderAliases,
  parseTrafficLimitBytes,
  remainingValue,
  resolveChartFamilies,
  resolveDetailCardKeys,
  resolveGeneralCardKeys,
  resolveQuickControlKeys,
} from '@/domain/theme-presentation'
import { probeSeries, visibleLoadCards } from '@/domain/detail-chart-options'
import { buildChartRows } from '@/domain/server-detail'
import { normalizeHistory, normalizeServer } from '@/services/cfsm/adapters'
import { cloneThemeSettings, DEFAULT_THEME_SETTINGS } from '@/theme/settings'
import type { GlassServer } from '@/types/glassmorphism'

const source = { base: 'https://status.example', label: 'status.example' }

function glass(overrides: Partial<GlassServer> = {}): GlassServer {
  return {
    key: 'source:node', id: 'node', sourceBase: source.base, sourceLabel: source.label,
    name: 'Acme Hong Kong Edge', group: 'Production', tags: ['premium'], region: 'HK',
    price: null, billingCycle: null, currency: null, expireDate: null, trafficLimit: null,
    trafficCalculationType: null, showPrice: true, showExpire: true, showTraffic: true,
    online: true, sortOrder: null, cpu: null, load: { one: null, five: null, fifteen: null },
    memory: { used: null, total: null, percentage: null },
    swap: { used: null, total: null, percentage: null },
    disk: { used: null, total: null, percentage: null },
    network: { inSpeed: null, outSpeed: null, received: null, transmitted: null, monthlyReceived: null, monthlyTransmitted: null },
    processes: null, tcpConnections: null, udpConnections: null, latency: [],
    history: { latencySeries: {}, packetLossSeries: {} }, gpus: [],
    connectivity: { ipv4: null, ipv6: null }, operatingSystem: null, architecture: null,
    cpuInfo: null, cpuCores: null, kernelVersion: null, agentVersion: null, bootTime: null, lastUpdated: null,
    ...overrides,
  }
}

describe('round 7 theme presentation contracts', () => {
  it('resolves presets and custom keys in configured order while dropping unsupported keys', () => {
    const settings = cloneThemeSettings(DEFAULT_THEME_SETTINGS)
    settings.generalCardPreset = '自定义'
    settings.generalCardKeys = 'trafficWarnings\navgCpu\nremainingValue\navgCpu'
    settings.homeQuickControlPreset = '自定义'
    settings.homeQuickControlKeys = 'offline,peak,fake'
    settings.detailMetricCardPreset = '自定义'
    settings.detailMetricCardKeys = 'cpuUsage\ntemperature\nconnections'
    settings.chartDashboardPreset = '自定义'
    settings.chartDashboardTemplate = '{"pingLoss":true,"connections":true,"cpu":true}'

    expect(resolveGeneralCardKeys(settings)).toEqual(['trafficWarnings', 'avgCpu'])
    expect(resolveQuickControlKeys(settings)).toEqual(['offline', 'peak'])
    expect(resolveDetailCardKeys(settings)).toEqual(['cpuUsage', 'connections'])
    // 连接数现在是真实可画的图表卡（`tcp_conn` / `udp_conn` 历史列），不再被当成不支持的 key 丢掉。
    expect(resolveChartFamilies(settings)).toEqual(['pingLoss', 'connections', 'cpu'])
  })

  it('aligns chart presets with Komari CHART_DASHBOARD_PRESETS and accepts its Chinese aliases', () => {
    const settings = cloneThemeSettings(DEFAULT_THEME_SETTINGS)
    // 上游默认七张卡 + 本主题独有的磁盘 IO（没有数据时不出现）。
    expect(resolveChartFamilies(settings)).toEqual(['cpu', 'memory', 'disk', 'network', 'gpu', 'connections', 'process', 'diskIo'])
    settings.chartDashboardPreset = '自定义'
    settings.chartDashboardTemplate = '内存\n连接\n磁盘IO\n温度\n内存'
    // 温度需要 CFSM 历史里没有的列，与重复项一起被丢掉。
    expect(resolveChartFamilies(settings)).toEqual(['memory', 'connections', 'diskIo'])
  })

  it('uses only reliable CFSM limits, expiry dates and normalized metrics for warnings', () => {
    const now = Date.UTC(2026, 8, 8, 12)
    const server = glass({
      cpu: 80,
      expireDate: '2026-09-18',
      trafficLimit: '1TB',
      trafficCalculationType: 'total',
      network: { inSpeed: 10, outSpeed: 20, received: 100, transmitted: 200, monthlyReceived: 600 * 1024 ** 3, monthlyTransmitted: 300 * 1024 ** 3 },
    })

    expect(parseTrafficLimitBytes('100')).toBe(100 * 1024 ** 3)
    expect(parseTrafficLimitBytes('1TB')).toBe(1024 ** 4)
    expect(parseTrafficLimitBytes('unlimited')).toBeNull()
    expect(isTrafficWarning(server, 80)).toBe(true)
    expect(daysUntilExpiry(server.expireDate, now)).toBe(10)
    expect(isExpiring(server, 30, now)).toBe(true)
    expect(isHighLoad(server, 80)).toBe(true)
  })

  it('keeps expiry summaries strict and computes remaining value only for official CFSM cycles', () => {
    const now = Date.UTC(2026, 0, 1)
    const annual = glass({ price: '60', currency: '€', billingCycle: 'five_years', expireDate: '2027-01-01T00:00:00Z' })

    expect(daysUntilExpiry('2025-12-31T23:59:59Z', now)).toBe(-1)
    expect(daysUntilExpiry('invalid', now)).toBeNull()
    expect(remainingValue(annual, now)).toBe(12)
    expect(remainingValue({ ...annual, billingCycle: 'custom' }, now)).toBeNull()
    expect(remainingValue({ ...annual, expireDate: 'invalid' }, now)).toBeNull()
    expect(remainingValue({ ...annual, expireDate: '2025-12-31T23:59:59Z' }, now)).toBe(0)
  })

  it('matches provider aliases only against real node text and builds truthful overview cards', () => {
    const settings = cloneThemeSettings(DEFAULT_THEME_SETTINGS)
    settings.generalCardPreset = '自定义'
    settings.generalCardKeys = 'onlineNodes\navgCpu\ntrafficWarnings'
    const server = glass({ cpu: 25 })
    const aliases = parseProviderAliases('Acme:premium,hong kong;Other:missing')

    expect(matchProvider(server, aliases)).toBe('Acme')
    expect(buildGeneralCards([server], settings).map((card) => card.key)).toEqual(['onlineNodes', 'avgCpu', 'trafficWarnings'])
  })

  it('builds detail cards and filters charts without synthesizing unavailable families', () => {
    const settings = cloneThemeSettings(DEFAULT_THEME_SETTINGS)
    settings.detailMetricCardPreset = '综合'
    settings.chartDashboardPreset = '自定义'
    settings.chartDashboardTemplate = 'cpu\npingLoss\ngpu'
    settings.gpuChartEnabled = true
    const server = normalizeServer({
      id: 'node', cpu: 20, ram_used: 512, ram_total: 1024, processes: 8,
      price: '30', billing_cycle: 'quarter', currency: '¥', expire_date: '2026-12-31',
      boot_time: 1_700_000_000,
    }, source)
    const rows = buildChartRows(normalizeHistory([{ timestamp: 1, cpu: 10, loss_node_1: 0 }]))
    const cards = buildDetailCards(server, settings, Date.UTC(2026, 8, 8))
    const lossSeries = probeSeries(rows, [{ target: 'node_1', label: 'Node 1' }], 'packetLoss', ['#FF6B6B'], false)
    const charts = visibleLoadCards(resolveChartFamilies(settings), rows, settings.gpuChartEnabled, {
      traffic: 0,
      ping: 0,
      pingLoss: lossSeries.length,
    })

    expect(cards.find((card) => card.key === 'monthlyCost')).toMatchObject({ value: '¥10.00', unit: '/ 月' })
    expect(cards.some((card) => card.key === 'memoryUsage')).toBe(true)
    expect(cards.some((card) => card.key === 'trafficQuota')).toBe(false)
    // GPU 在方案里且开关打开，但历史里没有 GPU 采样，卡片不出现；丢包 0 是有效值，卡片出现。
    expect(charts).toEqual(['cpu', 'pingLoss'])
  })
})
