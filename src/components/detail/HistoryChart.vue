<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { DetailChartModel, DetailChartPoint } from '@/domain/server-detail'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import {
  formatBytes,
  formatCount,
  formatLatency,
  formatLoad,
  formatPercent,
  formatProbePercent,
  formatSpeed,
} from '@/utils/format'
import '@/utils/echarts'

/**
 * 对齐 Komari `MetricSeriesChartCard`：同一套 `echarts` + `vue-echarts` 折线图，
 * 保留上游的 tooltip(axis) / legend / grid / time 轴 / `autoresize` 行为。
 *
 * CFSM 的数据真实性约束在这里严格保持：
 * - `connectNulls: false`，缺口保持缺口，不跨越缺失点连线；
 * - probe 的 `false`（未配置/缺失）与 `null`（超时）都不进入数值 series，
 *   绝不写成 0，也不插值；
 * - 稀疏历史点原样按真实时间戳落点。
 */
const props = defineProps<{
  chart: DetailChartModel
}>()
const theme = useThemeSettingsStore()

function numericValue(point: DetailChartPoint): number | null {
  return typeof point.value === 'number' && Number.isFinite(point.value) && point.value >= 0
    ? point.value
    : null
}

const sampleCount = computed(() => new Set(
  props.chart.series.flatMap((item) => item.points).map((point) => point.timestamp),
).size)

function formatMetric(value: number | null | false): string {
  if (props.chart.probeStates) {
    if (props.chart.kind === 'milliseconds') return formatLatency(value)
    if (props.chart.kind === 'percent') return formatProbePercent(value)
  }
  if (value === false || value === null) return '—'
  if (props.chart.kind === 'bytes') return formatBytes(value)
  if (props.chart.kind === 'speed') return formatSpeed(value)
  if (props.chart.kind === 'percent') return formatPercent(value)
  if (props.chart.kind === 'load') return formatLoad(value)
  if (props.chart.kind === 'milliseconds') return formatLatency(value)
  return formatCount(value)
}

/** 色觉友好模式下用线型区分序列，不只依赖颜色。 */
function seriesDash(index: number): number[] | undefined {
  if (theme.runtime.colorVisionMode !== '色觉友好') return undefined
  return [undefined, [8, 4], [3, 3], [10, 3, 2, 3], [2, 4]][index % 5]
}

const seriesSummary = computed(() => props.chart.series.map((item) => ({
  key: item.key,
  label: item.label,
  color: item.color,
  latest: item.points.at(-1)?.value ?? false,
  valid: item.points.filter((point) => numericValue(point) !== null).length,
  timedOut: item.points.filter((point) => point.value === null).length,
  missing: item.points.filter((point) => point.value === false).length,
})))

const chartOption = computed(() => ({
  animation: false,
  color: props.chart.series.map((item) => item.color),
  tooltip: {
    trigger: 'axis',
    confine: true,
    backgroundColor: 'var(--glass-strong)',
    borderColor: 'var(--glass-border)',
    borderWidth: 1,
    textStyle: { color: 'var(--ink)', fontSize: 11 },
    formatter: (params: unknown) => {
      const items = params as Array<{
        axisValueLabel?: string
        color: string
        data: [number, number | null]
        seriesName: string
      }>
      if (!items.length) return ''
      const rows = items.map((item) => (
        `<div style="display:flex;align-items:center;gap:8px">`
        + `<span style="width:8px;height:8px;border-radius:2px;background:${item.color};flex:none"></span>`
        + `<span>${item.seriesName}</span>`
        + `<strong style="margin-left:auto;padding-left:12px">${formatMetric(item.data?.[1] ?? null)}</strong>`
        + `</div>`
      )).join('')
      return `<div style="margin-bottom:6px;color:var(--muted)">${items[0]?.axisValueLabel ?? ''}</div>`
        + `<div style="display:flex;flex-direction:column;gap:4px">${rows}</div>`
    },
  },
  legend: {
    type: 'scroll',
    bottom: 2,
    itemWidth: 10,
    itemHeight: 8,
    textStyle: { color: 'var(--muted)', fontSize: 10 },
  },
  grid: { top: 20, right: 18, bottom: 48, left: 58 },
  xAxis: {
    type: 'time',
    axisLine: { lineStyle: { color: 'var(--line)' } },
    axisTick: { show: false },
    axisLabel: { color: 'var(--muted)', fontSize: 10, hideOverlap: true },
    splitLine: { show: false },
  },
  yAxis: {
    type: 'value',
    min: props.chart.percentScale ? 0 : undefined,
    max: props.chart.percentScale ? 100 : undefined,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: 'var(--muted)',
      fontSize: 10,
      formatter: (value: number) => formatMetric(value),
    },
    splitLine: { lineStyle: { color: 'var(--line)', opacity: 0.45 } },
  },
  series: props.chart.series.map((item, index) => ({
    name: item.label,
    type: 'line',
    // 只有真实数值进入 series；超时与缺失留空，由 connectNulls:false 形成断点。
    data: item.points.map((point) => [point.timestamp, numericValue(point)]),
    connectNulls: false,
    showSymbol: false,
    smooth: false,
    lineStyle: {
      width: 1.6,
      color: item.color,
      ...(seriesDash(index) ? { type: seriesDash(index) } : {}),
    },
  })),
}))
</script>

<template>
  <article class="history-chart glass-panel" :aria-label="chart.title">
    <header class="history-chart__header">
      <div>
        <span class="eyebrow">History</span>
        <h3>{{ chart.title }}</h3>
        <p>{{ chart.subtitle }}</p>
      </div>
      <span>{{ sampleCount }} 个真实点</span>
    </header>

    <div class="history-chart__canvas">
      <VChart :option="chartOption" autoresize />
    </div>

    <div class="history-chart__legend">
      <span
        v-for="item in seriesSummary"
        :key="item.key"
        :title="chart.probeStates ? `有效 ${item.valid} · 超时 ${item.timedOut} · 缺失 ${item.missing}` : undefined"
      >
        <i :style="{ backgroundColor: item.color }" />
        {{ item.label }}
        <strong>{{ formatMetric(item.latest) }}</strong>
        <small v-if="chart.probeStates">{{ item.valid }}/{{ item.timedOut }}/{{ item.missing }}</small>
      </span>
    </div>
  </article>
</template>
