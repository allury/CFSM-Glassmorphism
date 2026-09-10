<script setup lang="ts">
import { computed } from 'vue'
import defaultBackground from '@/assets/background/default-background-v2.webp'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { resolveBackgroundSource } from '@/theme/settings'

/**
 * 背景层。
 *
 * 没有自定义背景时使用 Komari 的正式默认背景图
 * （上游 `public/images/default-background-v2.webp`，32436 bytes，
 * SHA-256 42377961822666817def3d3b51b2c236a0f5f631dd1475535d9438a6b7ac551b），
 * 连同上游 `Background.vue` 的 cover / center bottom / filter / scale 一并移植。
 *
 * 该资产放在 `src/assets/` 而不是 `public/`：CFSM 主题 ZIP 根目录只允许
 * `index.html` 与 `assets/`，因此必须由 Vite 输出到 `dist/assets/`。
 *
 * CFSM 既有的自定义图片 / 视频、blur 与 overlay 能力保持不变，
 * 这里只替换「没有自定义背景时」的那一层。
 */

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
      <div class="dynamic-background__default" :style="{ backgroundImage: `url(${defaultBackground})` }" />
    </template>
  </div>
</template>
