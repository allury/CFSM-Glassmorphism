<script setup lang="ts">
import { computed } from 'vue'

/**
 * 对齐 Komari `components/ui/progress-thin`：细进度条，按状态着色。
 * 百分比为 null 时表示无采样，渲染为中性轨道而不是 0%。
 */
const props = withDefaults(defineProps<{
  percentage: number | null
  status?: 'normal' | 'warning' | 'danger' | 'neutral'
  height?: number
}>(), {
  status: 'normal',
  height: 4,
})

const width = computed(() => `${Math.min(100, Math.max(0, props.percentage ?? 0))}%`)
const tone = computed(() => (props.percentage === null ? 'neutral' : props.status))
</script>

<template>
  <div
    data-slot="progress-thin"
    class="resource-meter__track"
    :style="{ height: `${height}px` }"
    role="progressbar"
    :aria-valuenow="percentage ?? undefined"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <span class="resource-meter__fill" :class="`resource-meter__fill--${tone}`" :style="{ width }" />
  </div>
</template>
