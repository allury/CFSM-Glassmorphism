import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMetricHistoryCharts, buildProbeHistoryCharts } from '@/domain/server-detail'
import { ACCESSIBLE_LINE_TYPES, getChartSeriesPalette, getChartThemeColors, getLoadChartPalette } from '@/utils/chart-palette'
import type { HistoryPoint } from '@/types/cfsm'

const historyChart = readFileSync(new URL('../src/components/detail/HistoryChart.vue', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

/*
 * 第 15 轮的图表颜色回归。
 *
 * 根因：ECharts 走 `CanvasRenderer`，序列与坐标轴颜色最终落到 canvas 2D 的
 * `strokeStyle` / `fillStyle`，而 canvas **不解析 CSS 变量**——赋一个
 * `var(--emerald)` 会被直接丢弃。本主题此前把 `var(--emerald)` 这类值同时用于
 * 图表 option 与 HTML（tooltip 气泡、底部摘要色点），于是 HTML 一侧正常、
 * canvas 一侧全部画成纯黑。
 *
 * 浏览器像素实测（1440×900、浅色、本地生产构建）：
 * - 修复前，9 张图的绘图区取样只有 `0,0,0`；图例条带出现不透明白色文字。
 * - 修复后，绘图区取样为 `#FF6B6B` / `#4ECDC4` / `#A78BFA` / `#60A5FA` / `#FFB347`，
 *   与底部 HTML 摘要色点逐一相等；坐标轴与图例文字为 `rgba(0,0,0,0.55)`，
 *   深色模式下为 `rgba(255,255,255,0.55)`。
 * - 同一批取样在上游 Komari 详情页得到同一组色值，说明配色来源一致。
 *
 * 因此这里断言的是「进入图表的颜色一定是可被 canvas 解析的具体值」，
 * 而不是「源码里出现过某个颜色字符串」。
 */

const CSS_VAR = /var\(\s*--/

function point(timestamp: number, index: number): HistoryPoint {
  return {
    timestamp,
    cpu: 10 + index,
    gpus: [{ id: '0', name: 'NVIDIA T4', utilization: 20 + index }],
    memoryUsed: 2048 + index,
    memoryTotal: 8192,
    swapUsed: 256,
    swapTotal: 2048,
    diskUsed: 61440,
    diskTotal: 163840,
    networkInSpeed: 1_000_000 + index,
    networkOutSpeed: 600_000 + index,
    networkReceived: 4_000_000_000 + index,
    networkTransmitted: 2_000_000_000 + index,
    load1: 0.1,
    load5: 0.2,
    load15: 0.3,
    temperature: null,
    latency: { ct: 20 + index, cu: 30, cm: 40, bd: false, node_1: 50, node_2: false, node_3: false, node_4: false },
    packetLoss: { ct: 0, cu: 1, cm: 2, bd: false, node_1: 0, node_2: false, node_3: false, node_4: false },
    diskIo: { readBps: 8_000_000, writeBps: 3_000_000, readIops: 100, writeIops: 50, awaitMs: 0.4, utilization: 12 },
  }
}

const points = Array.from({ length: 6 }, (_, index) => point(1_700_000_000_000 + index * 300_000, index))

function allSeries() {
  return [...buildMetricHistoryCharts(points), ...buildProbeHistoryCharts(points)]
    .flatMap((chart) => chart.series.map((item) => ({ chart: chart.key, ...item })))
}

describe('进入 canvas 的颜色必须是具体色值', () => {
  it('每一条历史序列的颜色都不是 CSS 变量', () => {
    const series = allSeries()
    expect(series.length).toBeGreaterThan(10)
    for (const item of series) {
      expect(item.color, `${item.chart}/${item.key}`).not.toMatch(CSS_VAR)
      expect(item.color, `${item.chart}/${item.key}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('序列颜色全部来自两块调色板，不出现调色板之外的自造色', () => {
    const allowed = new Set([...getChartSeriesPalette(false), ...Object.values(getLoadChartPalette(false))])
    for (const item of allSeries()) expect(allowed.has(item.color), `${item.chart}/${item.key} = ${item.color}`).toBe(true)
  })

  it('图表主题色在深浅两种模式下都是具体 rgba，且逐项不同', () => {
    const light = getChartThemeColors(false)
    const dark = getChartThemeColors(true)
    for (const key of Object.keys(light) as Array<keyof typeof light>) {
      expect(light[key]).not.toMatch(CSS_VAR)
      expect(dark[key]).not.toMatch(CSS_VAR)
      expect(light[key]).toMatch(/^rgba\(/)
      // 切换主题后不能残留同一个值，否则深色下坐标轴文字会看不见。
      expect(dark[key], key).not.toBe(light[key])
    }
  })

  it('图表组件的 option 里不再出现任何 CSS 变量', () => {
    const option = historyChart.slice(historyChart.indexOf('const chartOption'), historyChart.indexOf('</script>'))
    expect(option).not.toMatch(CSS_VAR)
  })
})

/*
 * 第二阶段 Test 1：逐序列对照上游，而不是「都来自调色板」就算对齐。
 * 取值直接读自 Komari `bf83765` 的 `LoadChart.vue`：
 *   CPU     CPU=primary(+area) / 负载=secondary(第二根轴)
 *   memory  RAM=primary(+area) / Swap=secondary
 *   disk    磁盘已用=tertiary(+area)
 *   network 下载=quinary / 上传=quaternary，**两条都没有 areaStyle**
 *   gpu     GPU 使用率=senary
 *   traffic 累计下载=quinary / 累计上传=quaternary（走 MetricSeriesChartCard）
 * 内联图线形是 `width: 1.5` + `cap: 'round'`，卡片图是 `width: 1.6` 且无 cap。
 */
describe('逐序列对照上游 LoadChart', () => {
  const load = getLoadChartPalette(false)
  const charts = Object.fromEntries(buildMetricHistoryCharts(points).map((c) => [c.key, c]))
  function pick(chartKey: string, seriesKey: string) {
    const item = charts[chartKey]?.series.find((s) => s.key === seriesKey)
    expect(item, `${chartKey}/${seriesKey} 缺失`).toBeDefined()
    return item!
  }

  it('语义序列取到上游同名序列的角色色', () => {
    expect(pick('cpu', 'cpu').color).toBe(load.primary)
    expect(pick('memory', 'ram').color).toBe(load.primary)
    expect(pick('memory', 'swap').color).toBe(load.secondary)
    expect(pick('disk', 'disk').color).toBe(load.tertiary)
    expect(pick('network-speed', 'network-in').color).toBe(load.quinary)
    expect(pick('network-speed', 'network-out').color).toBe(load.quaternary)
    expect(pick('traffic', 'network-rx').color).toBe(load.quinary)
    expect(pick('traffic', 'network-tx').color).toBe(load.quaternary)
    expect(pick('gpu', 'gpu-0').color).toBe(load.senary)
  })

  it('只有上游确有 areaStyle 的序列才带填充', () => {
    expect(pick('cpu', 'cpu').area).toEqual({ strong: load.primaryAreaStrong, faint: load.primaryAreaFaint })
    expect(pick('memory', 'ram').area).toEqual({ strong: load.primaryAreaStrong, faint: load.primaryAreaFaint })
    expect(pick('disk', 'disk').area).toEqual({ strong: load.tertiaryAreaStrong, faint: load.tertiaryAreaFaint })
    // 上游网络图、Swap、流量、探针都没有填充——不能一刀切给所有内联图加 areaStyle。
    expect(pick('memory', 'swap').area).toBeUndefined()
    expect(pick('network-speed', 'network-in').area).toBeUndefined()
    expect(pick('network-speed', 'network-out').area).toBeUndefined()
    expect(pick('traffic', 'network-rx').area).toBeUndefined()
    for (const item of buildProbeHistoryCharts(points).flatMap((c) => c.series)) {
      expect(item.area, item.key).toBeUndefined()
    }
  })

  it('线宽与线帽按所对应的上游组件区分', () => {
    for (const key of ['cpu', 'load', 'memory', 'disk', 'network-speed', 'gpu']) {
      for (const item of charts[key]?.series ?? []) {
        expect(item.lineWidth, `${key}/${item.key}`).toBe(1.5)
        expect(item.roundCap, `${key}/${item.key}`).toBe(true)
      }
    }
    for (const key of ['traffic', 'disk-io']) {
      for (const item of charts[key]?.series ?? []) {
        expect(item.lineWidth, `${key}/${item.key}`).toBe(1.6)
        expect(item.roundCap, `${key}/${item.key}`).toBe(false)
      }
    }
    for (const item of buildProbeHistoryCharts(points).flatMap((c) => c.series)) {
      expect(item.lineWidth, item.key).toBe(1.6)
      expect(item.roundCap, item.key).toBe(false)
    }
  })

  it('图表组件按序列自身的线形与填充渲染', () => {
    expect(historyChart).toContain('width: item.lineWidth')
    expect(historyChart).toContain("item.roundCap ? { cap: 'round' as const } : {}")
    expect(historyChart).toContain('item.area')
    expect(historyChart).toContain('colorStops')
  })
})

describe('折线、图例与摘要取同一个颜色来源', () => {
  it('series 的 lineStyle、itemStyle 与底部摘要都用 item.color', () => {
    expect(historyChart).toContain('color: item.color')
    expect(historyChart).toContain('itemStyle: { color: item.color }')
    // 顶层 palette、tooltip 色点与底部摘要色点同样取自序列自身的颜色。
    expect(historyChart).toContain('color: props.chart.series.map((item) => item.color)')
    expect(historyChart).toContain('background:${item.color}')
    expect(historyChart).toContain(':style="{ backgroundColor: item.color }"')
  })
})

describe('色觉友好模式', () => {
  it('换成上游的无障碍调色板，而不是仅改线型', () => {
    const standard = getChartSeriesPalette(false)
    const accessible = getChartSeriesPalette(true)
    expect(accessible).not.toEqual(standard)
    expect(accessible[0]).toBe('#0072B2')
    for (const color of accessible) expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('指标图按角色板切换，探针图按序列板切换', () => {
    const accessibleLoad = getLoadChartPalette(true)
    const loadRoles = new Set(Object.values(accessibleLoad))
    const metric = buildMetricHistoryCharts(points, accessibleLoad)
    for (const item of metric.flatMap((chart) => chart.series)) {
      expect(loadRoles.has(item.color), `${item.key} = ${item.color}`).toBe(true)
    }
    const accessibleSeries = getChartSeriesPalette(true)
    const probe = buildProbeHistoryCharts(points, undefined, accessibleSeries)
    for (const item of probe.flatMap((chart) => chart.series)) {
      expect(accessibleSeries).toContain(item.color)
    }
  })

  it('线型取上游 ACCESSIBLE_LINE_TYPES，不自造虚线段长', () => {
    expect([...ACCESSIBLE_LINE_TYPES]).toEqual(['solid', 'dashed', 'dotted'])
    expect(historyChart).toContain('ACCESSIBLE_LINE_TYPES[index % ACCESSIBLE_LINE_TYPES.length]')
  })
})

describe('修颜色没有动数据语义', () => {
  it('缺口仍然是缺口：connectNulls 关闭，false / null 不写成 0', () => {
    expect(historyChart).toContain('connectNulls: false')
    const ping = buildProbeHistoryCharts(points).find((chart) => chart.key === 'ping')
    const bd = ping?.series.find((item) => item.key === 'ping-bd')
    // bd 全程 false，整条序列不应该被造出来。
    expect(bd).toBeUndefined()
    const ct = ping?.series.find((item) => item.key === 'ping-ct')
    expect(ct?.points.every((item) => item.value !== 0)).toBe(true)
  })

  it('时间戳按真实值升序落点，没有被重采样', () => {
    const cpu = buildMetricHistoryCharts(points).find((chart) => chart.key === 'cpu')
    expect(cpu?.series[0]?.points.map((item) => item.timestamp))
      .toEqual(points.map((item) => item.timestamp))
  })
})
