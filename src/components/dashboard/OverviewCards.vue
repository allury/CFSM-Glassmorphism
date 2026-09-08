<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { buildGeneralCards } from '@/domain/theme-presentation'
import type { ThemeSettings } from '@/theme/settings'
import type { GlassServer } from '@/types/glassmorphism'

/**
 * 对齐 Komari `NodeGeneralCards` 的总览卡片。
 *
 * Komari 的总览区没有独立标题块，卡片本身就是 12 栅格中的 `col-span-4` 单元：
 * 标签在左上、图标在右上（淡色、hover 变深），数值与单位基线对齐放在卡片底部。
 * 这里保持同一 DOM 层级与视觉treatment，只把数据源换成 CFSM 的 normalized model。
 */
const props = defineProps<{
  servers: GlassServer[]
  settings: ThemeSettings
}>()

const cards = computed(() => buildGeneralCards(props.servers, props.settings))
</script>

<template>
  <div class="overview-grid" role="group" aria-label="节点总览">
    <article
      v-for="card in cards"
      :key="card.key"
      class="overview-card"
      :data-general-card-key="card.key"
    >
      <div class="overview-card__head">
        <span class="overview-card__label">{{ card.label }}</span>
        <AppIcon class="overview-card__icon" :name="card.icon" :size="20" />
      </div>
      <div class="overview-card__value">
        <span class="overview-card__number">{{ card.value }}</span>
        <span v-if="card.hint" class="overview-card__unit">{{ card.hint }}</span>
      </div>
    </article>
  </div>
</template>
