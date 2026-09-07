<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  content: string
  placement?: 'top' | 'bottom'
  as?: string
}>(), {
  placement: 'top',
  as: 'span',
})

const tooltipId = useId()
</script>

<template>
  <component
    :is="as"
    class="app-tooltip"
    :aria-describedby="tooltipId"
  >
    <slot />
    <span
      :id="tooltipId"
      role="tooltip"
      class="app-tooltip__bubble"
      :class="`app-tooltip__bubble--${placement}`"
    >
      {{ content }}
    </span>
  </component>
</template>
