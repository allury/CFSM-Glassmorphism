<script setup lang="ts">
import { computed } from 'vue'
import type { GlassResourceMetric } from '@/types/glassmorphism'
import { formatMebibytes, formatPercent } from '@/utils/format'

const props = defineProps<{
  label: string
  metric: GlassResourceMetric
}>()

const fillStyle = computed(() => ({
  width: (props.metric.percentage ?? 0) + '%',
}))
const tone = computed(() => {
  const percentage = props.metric.percentage
  if (percentage === null) return 'neutral'
  if (percentage >= 90) return 'danger'
  if (percentage >= 75) return 'warning'
  return 'normal'
})
const detail = computed(() => {
  if (props.metric.used === null && props.metric.total === null) return '—'
  if (props.metric.total === null) return formatMebibytes(props.metric.used)
  return formatMebibytes(props.metric.used) + ' / ' + formatMebibytes(props.metric.total)
})
</script>

<template>
  <div class="resource-meter">
    <div class="resource-meter__header">
      <span>{{ label }}</span>
      <strong>{{ formatPercent(metric.percentage) }}</strong>
    </div>
    <div
      class="resource-meter__track"
      role="meter"
      :aria-label="label"
      :aria-valuenow="metric.percentage ?? undefined"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span
        class="resource-meter__fill"
        :class="`resource-meter__fill--${tone}`"
        :style="fillStyle"
      />
    </div>
    <span class="resource-meter__detail">{{ detail }}</span>
  </div>
</template>
