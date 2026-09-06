<script setup lang="ts">
import type { DashboardSummary } from '@/types/glassmorphism'
import {
  formatBytes,
  formatMebibytes,
  formatPercent,
  formatSpeed,
} from '@/utils/format'

defineProps<{
  summary: DashboardSummary
}>()
</script>

<template>
  <section class="overview-grid" aria-label="节点总览">
    <article class="overview-card overview-card--status">
      <span class="overview-card__label">节点状态</span>
      <strong>{{ summary.online }} <small>/ {{ summary.total }}</small></strong>
      <span>{{ summary.offline }} 台离线</span>
    </article>

    <article class="overview-card">
      <span class="overview-card__label">在线平均 CPU</span>
      <strong>{{ formatPercent(summary.averageCpu) }}</strong>
      <span>仅统计有 CPU 数据的在线节点</span>
    </article>

    <article class="overview-card">
      <span class="overview-card__label">内存</span>
      <strong>{{ formatPercent(summary.memory.percentage) }}</strong>
      <span>{{ formatMebibytes(summary.memory.used) }} / {{ formatMebibytes(summary.memory.total) }}</span>
    </article>

    <article class="overview-card">
      <span class="overview-card__label">磁盘</span>
      <strong>{{ formatPercent(summary.disk.percentage) }}</strong>
      <span>{{ formatMebibytes(summary.disk.used) }} / {{ formatMebibytes(summary.disk.total) }}</span>
    </article>

    <article class="overview-card">
      <span class="overview-card__label">实时速率</span>
      <strong class="overview-card__split">
        <span>↓ {{ formatSpeed(summary.networkInSpeed) }}</span>
        <span>↑ {{ formatSpeed(summary.networkOutSpeed) }}</span>
      </strong>
      <span>在线节点合计</span>
    </article>

    <article class="overview-card">
      <span class="overview-card__label">累计流量</span>
      <strong class="overview-card__split">
        <span>↓ {{ formatBytes(summary.trafficReceived) }}</span>
        <span>↑ {{ formatBytes(summary.trafficTransmitted) }}</span>
      </strong>
      <span>有数据节点合计</span>
    </article>
  </section>
</template>
