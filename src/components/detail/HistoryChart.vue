<script setup lang="ts">
import { computed } from 'vue'
import type { DetailChartModel, DetailChartPoint } from '@/domain/server-detail'
import {
  formatBytes,
  formatCount,
  formatLatency,
  formatLoad,
  formatPercent,
  formatProbePercent,
  formatSpeed,
  formatTimestamp,
} from '@/utils/format'

const props = defineProps<{
  chart: DetailChartModel
}>()

const WIDTH = 800
const HEIGHT = 220
const LEFT = 54
const RIGHT = 18
const TOP = 18
const BOTTOM = 32

function numericValue(point: DetailChartPoint): number | null {
  return typeof point.value === 'number' && Number.isFinite(point.value) && point.value >= 0
    ? point.value
    : null
}

const timeline = computed(() => props.chart.series.flatMap((item) => item.points))
const sampleCount = computed(() => new Set(
  timeline.value.map((point) => point.timestamp),
).size)
const xMin = computed(() => Math.min(...timeline.value.map((point) => point.timestamp)))
const xMax = computed(() => Math.max(...timeline.value.map((point) => point.timestamp)))
const numericValues = computed(() => timeline.value.flatMap((point) => {
  const value = numericValue(point)
  return value === null ? [] : [value]
}))
const yMax = computed(() => {
  if (props.chart.percentScale) return 100
  const maximum = Math.max(...numericValues.value, 0)
  return maximum > 0 ? maximum * 1.08 : 1
})

function pointX(timestamp: number): number {
  if (xMax.value === xMin.value) return (LEFT + WIDTH - RIGHT) / 2
  return LEFT + ((timestamp - xMin.value) / (xMax.value - xMin.value)) * (WIDTH - LEFT - RIGHT)
}

function pointY(value: number): number {
  return TOP + (1 - Math.min(value / yMax.value, 1)) * (HEIGHT - TOP - BOTTOM)
}

function pathSegments(points: DetailChartPoint[]): string[] {
  const segments: string[] = []
  let current = ''
  for (const point of points) {
    const value = numericValue(point)
    if (value === null) {
      if (current) segments.push(current)
      current = ''
      continue
    }
    const coordinate = `${pointX(point.timestamp).toFixed(2)} ${pointY(value).toFixed(2)}`
    current += `${current ? ' L' : 'M'}${coordinate}`
  }
  if (current) segments.push(current)
  return segments
}

const renderedSeries = computed(() => props.chart.series.map((item) => {
  const latestPoint = item.points.at(-1)
  const latest = latestPoint ? latestPoint.value : false
  const valid = item.points.filter((point) => numericValue(point) !== null).length
  const timedOut = item.points.filter((point) => point.value === null).length
  const missing = item.points.filter((point) => point.value === false).length
  return {
    ...item,
    paths: pathSegments(item.points),
    dots: valid === 1
      ? item.points.flatMap((point) => {
          const value = numericValue(point)
          return value === null ? [] : [{ x: pointX(point.timestamp), y: pointY(value) }]
        })
      : [],
    latest,
    valid,
    timedOut,
    missing,
  }
}))

const ticks = computed(() => [yMax.value, yMax.value / 2, 0])

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
      <svg viewBox="0 0 800 220" role="img" :aria-label="`${chart.title}历史折线图`">
        <g class="history-chart__grid">
          <template v-for="(tick, index) in ticks" :key="tick">
            <line :x1="LEFT" :x2="WIDTH - RIGHT" :y1="TOP + index * 85" :y2="TOP + index * 85" />
            <text x="4" :y="TOP + index * 85 + 4">{{ formatMetric(tick) }}</text>
          </template>
        </g>
        <g v-for="item in renderedSeries" :key="item.key">
          <path
            v-for="(path, index) in item.paths"
            :key="index"
            class="history-chart__line"
            :d="path"
            :stroke="item.color"
          />
          <circle
            v-for="(dot, index) in item.dots"
            :key="`dot-${index}`"
            :cx="dot.x"
            :cy="dot.y"
            r="3.5"
            :fill="item.color"
          />
        </g>
        <text class="history-chart__time" :x="LEFT" :y="HEIGHT - 7">{{ formatTimestamp(xMin) }}</text>
        <text class="history-chart__time" :x="WIDTH - RIGHT" :y="HEIGHT - 7" text-anchor="end">{{ formatTimestamp(xMax) }}</text>
      </svg>
    </div>

    <div class="history-chart__legend">
      <span
        v-for="item in renderedSeries"
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
