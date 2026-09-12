<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { ThemeMode } from '@/theme/settings'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppTooltip from '@/components/ui/AppTooltip.vue'

/**
 * 与 Komari `Header.vue` 一致：只承载站点身份与全局动作。
 * 首页的高级工具开关属于控制区，不放在 Header 里。
 */
withDefaults(defineProps<{
  title: string
  version: string | null
  loading: boolean
  online?: number
  total?: number
  sourceCount?: number
  adminUrl: string | null
  themeMode: ThemeMode
  /*
   * 设置页不订阅节点数据，显示「0/0 在线」会是假状态，因此那里关掉状态条，
   * 只保留站点身份与全局动作——首页与详情页仍然照旧显示真实计数。
   */
  showStatus?: boolean
}>(), {
  online: 0,
  total: 0,
  sourceCount: 0,
  showStatus: true,
})

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

      <div v-if="showStatus" class="header-status" aria-label="REST 数据状态">
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
            <AppIcon :name="themeMode === 'light' ? 'tabler:sun' : 'tabler:moon'" :size="18" />
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
            <AppIcon name="tabler:refresh" :size="18" />
          </button>
        </AppTooltip>
        <AppTooltip content="主题设置">
          <RouterLink class="icon-button" :to="{ name: 'theme-settings' }" aria-label="主题设置">
            <AppIcon name="tabler:settings" :size="18" />
          </RouterLink>
        </AppTooltip>
        <AppTooltip v-if="adminUrl" content="打开 CFSM 官方管理端">
          <a class="icon-button" :href="adminUrl" aria-label="管理端">
            <AppIcon name="tabler:external-link" :size="18" />
          </a>
        </AppTooltip>
      </div>
    </div>
  </header>
</template>
