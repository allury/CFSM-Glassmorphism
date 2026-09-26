<script setup lang="ts">
import { computed } from 'vue'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { resolveBackgroundSource } from '@/theme/settings'

/** CFSM 全局 Turnstile 的人机验证占据遮罩时隐藏转圈与 Loading 文字，只留验证组件。 */
defineProps<{ challenge?: boolean }>()

const theme = useThemeSettingsStore()
const hasCustomBackground = computed(() => {
  if (!theme.configResolved) return theme.coldStartBackgroundEnabled
  const source = theme.resolvedTheme === 'dark'
    ? theme.runtime.darkBackgroundUrl
    : theme.runtime.lightBackgroundUrl
  return theme.runtime.backgroundEnabled && Boolean(resolveBackgroundSource(source))
})
</script>

<template>
  <div class="loading-cover" :class="{ 'loading-cover--custom-background': hasCustomBackground }">
    <div class="loading-cover__indicator" :class="{ 'loading-cover__indicator--custom': hasCustomBackground }">
      <span v-if="!challenge" class="loading-cover__spinner" :class="{ 'loading-cover__spinner--custom': hasCustomBackground }" />
      <span v-if="!challenge && !hasCustomBackground" class="loading-cover__text">Loading...</span>
      <!-- CFSM 全局 Turnstile 的人机验证（App.vue 按需放入）；上游没有这一项。 -->
      <slot />
    </div>
  </div>
</template>
