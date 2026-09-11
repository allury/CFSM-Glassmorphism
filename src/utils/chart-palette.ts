/**
 * 图表配色，逐字移植自 Komari `utils/chartPalette.ts`。
 *
 * 这里**必须**是具体色值，不能写 `var(--x)`：ECharts 走的是 `CanvasRenderer`，
 * 序列颜色最终落到 canvas 的 `strokeStyle`，而 canvas 2D 不解析 CSS 变量——
 * 赋一个 `var(--emerald)` 会被直接丢弃，线条留在上一次的样式上（实测是纯黑 `0,0,0`）。
 * HTML 那一侧（tooltip 气泡、底部摘要色点）反而能解析，于是出现
 * 「折线全黑、但 tooltip 与色点颜色正常」这种前后不一致。
 *
 * 上游同样为色觉友好模式准备了一套独立调色板与线型，二者一并移植。
 */

const DEFAULT_SERIES_PALETTE = [
  '#FF6B6B',
  '#4ECDC4',
  '#A78BFA',
  '#60A5FA',
  '#FFB347',
  '#F472B6',
  '#34D399',
  '#FB923C',
]

const ACCESSIBLE_SERIES_PALETTE = [
  '#0072B2',
  '#E69F00',
  '#009E73',
  '#CC79A7',
  '#D55E00',
  '#56B4E9',
  '#F0C94A',
  '#6B7280',
]

/** 上游 `ACCESSIBLE_LINE_TYPES`：色觉友好模式下再用线型区分一层。 */
export const ACCESSIBLE_LINE_TYPES = ['solid', 'dashed', 'dotted'] as const

export type ChartLineType = (typeof ACCESSIBLE_LINE_TYPES)[number]

export function getChartSeriesPalette(accessible: boolean): string[] {
  return [...(accessible ? ACCESSIBLE_SERIES_PALETTE : DEFAULT_SERIES_PALETTE)]
}

/**
 * 图表内的文字、坐标轴、网格与 tooltip 底色，逐字移植自上游
 * `LoadChart.vue` / `PingChart.vue` 的 `chartThemeColors`。
 * 同样只能是具体色值，并且随浅色 / 深色切换。
 */
export function getChartThemeColors(dark: boolean) {
  return {
    text: dark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)',
    textSecondary: dark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)',
    textTertiary: dark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
    borderColor: dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    splitLineColor: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    tooltipBg: dark ? 'rgba(40, 40, 40, 0.95)' : 'rgba(255, 255, 255, 0.8)',
    tooltipShadow: dark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.06)',
    crosshairColor: dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
  }
}

export type ChartThemeColors = ReturnType<typeof getChartThemeColors>
