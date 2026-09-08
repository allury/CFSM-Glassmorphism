<script setup lang="ts">
import { computed } from 'vue'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { resolveBackgroundSource } from '@/theme/settings'

const theme = useThemeSettingsStore()
const selectedSource = computed(() => resolveBackgroundSource(
  theme.resolvedTheme === 'dark'
    ? theme.runtime.darkBackgroundUrl
    : theme.runtime.lightBackgroundUrl,
))
const customBackground = computed(() => (
  theme.runtime.backgroundEnabled && selectedSource.value !== ''
))
const mediaStyle = computed(() => ({
  filter: `blur(${theme.runtime.backgroundBlur}px)`,
  transform: theme.runtime.backgroundBlur > 0 ? 'scale(1.04)' : 'none',
}))
const overlayStyle = computed(() => {
  const overlay = theme.runtime.backgroundOverlay
  const opacity = Math.abs(overlay) / 100
  return {
    backgroundColor: overlay >= 0
      ? `rgb(0 0 0 / ${opacity})`
      : `rgb(255 255 255 / ${opacity * 0.7})`,
  }
})
</script>

<template>
  <div class="dynamic-background" :class="{ 'dynamic-background--custom': customBackground }" aria-hidden="true">
    <template v-if="customBackground">
      <img
        v-if="theme.runtime.backgroundType === 'image'"
        class="dynamic-background__media"
        :src="selectedSource"
        alt=""
        decoding="async"
        referrerpolicy="no-referrer"
        :style="mediaStyle"
      >
      <video
        v-else
        class="dynamic-background__media"
        :src="selectedSource"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        :style="mediaStyle"
      />
      <div class="dynamic-background__overlay" :style="overlayStyle" />
    </template>
    <template v-else>
      <div class="dynamic-background__wash" />
      <div class="dynamic-background__orb dynamic-background__orb--one" />
      <div class="dynamic-background__orb dynamic-background__orb--two" />
      <div class="dynamic-background__orb dynamic-background__orb--three" />
      <div class="dynamic-background__grid" />
      <div class="dynamic-background__grain" />
    </template>
  </div>
</template>
