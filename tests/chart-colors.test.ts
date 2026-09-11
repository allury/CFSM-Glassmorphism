import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildMetricHistoryCharts, buildProbeHistoryCharts } from '@/domain/server-detail'
import { ACCESSIBLE_LINE_TYPES, getChartSeriesPalette, getChartThemeColors } from '@/utils/chart-palette'
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

  it('序列颜色全部来自调色板，不出现调色板之外的自造色', () => {
    const palette = new Set(getChartSeriesPalette(false))
    for (const item of allSeries()) expect(palette.has(item.color), `${item.chart}/${item.key} = ${item.color}`).toBe(true)
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

  it('调色板传进构建器后，序列颜色整体跟着切换', () => {
    const accessible = getChartSeriesPalette(true)
    const charts = buildMetricHistoryCharts(points, accessible)
    const used = new Set(charts.flatMap((chart) => chart.series.map((item) => item.color)))
    for (const color of used) expect(accessible).toContain(color)
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
