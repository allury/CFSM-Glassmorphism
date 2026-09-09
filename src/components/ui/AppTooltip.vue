<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'

/**
 * 对齐 Komari `components/ui/tooltip` 的 reka-ui 组件族。
 *
 * 与上游一致地由 `TooltipProvider / Root / Trigger / Portal / Content / Arrow` 组成，
 * 因此具备真实的 portal 渲染、碰撞翻转、ESC 关闭、指针与键盘焦点行为；
 * 样式使用本主题的玻璃层次令牌而非 Tailwind 工具类。
 *
 * 保留原有调用 API（`content` / `placement` / `as`），调用点无需改动。
 */
withDefaults(defineProps<{
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  as?: string
}>(), {
  placement: 'top',
  as: 'span',
})
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <TooltipRoot data-slot="tooltip">
      <TooltipTrigger :as="as" data-slot="tooltip-trigger" class="app-tooltip">
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          data-slot="tooltip-content"
          class="app-tooltip__bubble"
          :side="placement"
          :side-offset="6"
          :collision-padding="8"
        >
          {{ content }}
          <TooltipArrow class="app-tooltip__arrow" :width="10" :height="5" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
