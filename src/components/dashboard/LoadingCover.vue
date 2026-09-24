<script setup lang="ts">
import { computed } from 'vue'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { resolveBackgroundSource } from '@/theme/settings'

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
      <span class="loading-cover__spinner" :class="{ 'loading-cover__spinner--custom': hasCustomBackground }" />
      <span v-if="!hasCustomBackground" class="loading-cover__text">Loading...</span>
    </div>
  </div>
</template>
