<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { ThemeMode } from '@/theme/settings'
import AppTooltip from '@/components/ui/AppTooltip.vue'

defineProps<{
  title: string
  version: string | null
  loading: boolean
  online: number
  total: number
  sourceCount: number
  adminUrl: string | null
  themeMode: ThemeMode
}>()

defineEmits<{
  refresh: []
  cycleTheme: []
}>()

const scrolled = ref(false)

function updateScrolled(): void {
  scrolled.value = window.scrollY > 12
}

onMounted(() => {
  updateScrolled()
  window.addEventListener('scroll', updateScrolled, { passive: true })
})

onUnmounted(() => window.removeEventListener('scroll', updateScrolled))
</script>

<template>
  <header class="app-header" :class="{ 'app-header--scrolled': scrolled }">
    <div class="app-header__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">
          <span />
        </span>
        <div class="brand__copy">
          <strong>{{ title }}</strong>
          <span>
            CFSM Glassmorphism Theme
            <template v-if="version">· v{{ version }}</template>
          </span>
        </div>
      </div>

      <div class="header-status" aria-label="REST 数据状态">
        <span
          class="status-dot"
          :class="loading ? 'status-dot--pending' : 'status-dot--online'"
        />
        <span>{{ online }}/{{ total }} 在线</span>
        <span class="header-status__divider" aria-hidden="true" />
        <span>{{ sourceCount }} 个数据源</span>
      </div>

      <div class="header-actions">
        <AppTooltip :content="`主题：${themeMode === 'beijing' ? '北京时间自动' : themeMode === 'system' ? '跟随系统' : themeMode === 'light' ? '浅色' : '深色'}（点击切换）`">
          <button
            class="icon-button"
            type="button"
            :aria-label="`切换主题，当前${themeMode}`"
            @click="$emit('cycleTheme')"
          >
            <svg v-if="themeMode === 'light'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            <svg v-else-if="themeMode === 'dark'" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 15.1A9 9 0 0 1 8.9 3.2 9 9 0 1 0 20.8 15.1Z" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Z" /><path d="M12 3v18A9 9 0 0 0 12 3Z" /></svg>
          </button>
        </AppTooltip>
        <AppTooltip content="刷新 REST 数据">
          <button
            class="icon-button"
            :class="{ 'is-spinning': loading }"
            type="button"
            :disabled="loading"
            aria-label="刷新 REST 数据"
            @click="$emit('refresh')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5" /><path d="M19 11a7 7 0 1 0 .2 3" /></svg>
          </button>
        </AppTooltip>
        <AppTooltip content="主题设置">
          <RouterLink class="icon-button" :to="{ name: 'theme-settings' }" aria-label="主题设置">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></svg>
          </RouterLink>
        </AppTooltip>
        <AppTooltip v-if="adminUrl" content="打开 CFSM 官方管理端">
          <a class="icon-button" :href="adminUrl" aria-label="管理端">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>
          </a>
        </AppTooltip>
      </div>
    </div>
  </header>
</template>
