<script setup lang="ts">
import { computed } from 'vue'
import { buildGeneralCards } from '@/domain/theme-presentation'
import type { ThemeSettings } from '@/theme/settings'
import type { GlassServer } from '@/types/glassmorphism'

const props = defineProps<{
  servers: GlassServer[]
  settings: ThemeSettings
}>()

const cards = computed(() => buildGeneralCards(props.servers, props.settings))
</script>

<template>
  <section class="overview-stage" aria-label="节点总览">
    <div class="overview-stage__heading">
      <div>
        <span class="eyebrow">Overview</span>
        <h1>节点总览</h1>
      </div>
      <p>来自 CFSM REST 的当前快照</p>
    </div>
    <div class="overview-grid">
      <article v-for="card in cards" :key="card.key" class="overview-card" :class="`overview-card--${card.key}`">
        <span class="overview-card__icon" aria-hidden="true">{{ card.icon }}</span>
        <span class="overview-card__label">{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <span>{{ card.hint }}</span>
      </article>
    </div>
  </section>
</template>
