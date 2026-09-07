<script setup lang="ts">
import type { DashboardSummary } from '@/types/glassmorphism'
import type { GlassResourceMetric } from '@/types/glassmorphism'
import AppTooltip from '@/components/ui/AppTooltip.vue'
import {
  formatBytes,
  formatMebibytes,
  formatPercent,
  formatSpeed,
} from '@/utils/format'

defineProps<{
  summary: DashboardSummary
}>()

function resourceTooltip(metric: GlassResourceMetric): string {
  return `已用 ${formatMebibytes(metric.used)}\n总计 ${formatMebibytes(metric.total)}`
}
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
      <article class="overview-card overview-card--status">
        <span class="overview-card__icon" aria-hidden="true">◉</span>
        <span class="overview-card__label">在线节点</span>
        <strong>{{ summary.online }} <small>/ {{ summary.total }}</small></strong>
        <span>{{ summary.offline }} 台离线</span>
      </article>

      <article class="overview-card">
        <span class="overview-card__icon" aria-hidden="true">⌁</span>
        <span class="overview-card__label">在线平均 CPU</span>
        <strong>{{ formatPercent(summary.averageCpu) }}</strong>
        <span>有采样的在线节点</span>
      </article>

      <article class="overview-card">
        <span class="overview-card__icon" aria-hidden="true">▥</span>
        <span class="overview-card__label">内存</span>
        <AppTooltip :content="resourceTooltip(summary.memory)">
          <strong>{{ formatPercent(summary.memory.percentage) }}</strong>
        </AppTooltip>
        <span>{{ formatMebibytes(summary.memory.used) }} / {{ formatMebibytes(summary.memory.total) }}</span>
      </article>

      <article class="overview-card">
        <span class="overview-card__icon" aria-hidden="true">▰</span>
        <span class="overview-card__label">磁盘</span>
        <AppTooltip :content="resourceTooltip(summary.disk)">
          <strong>{{ formatPercent(summary.disk.percentage) }}</strong>
        </AppTooltip>
        <span>{{ formatMebibytes(summary.disk.used) }} / {{ formatMebibytes(summary.disk.total) }}</span>
      </article>

      <article class="overview-card">
        <span class="overview-card__icon" aria-hidden="true">⇅</span>
        <span class="overview-card__label">实时速率</span>
        <strong class="overview-card__split">
          <span>↑ {{ formatSpeed(summary.networkOutSpeed) }}</span>
          <span>↓ {{ formatSpeed(summary.networkInSpeed) }}</span>
        </strong>
        <span>在线节点合计</span>
      </article>

      <article class="overview-card">
        <span class="overview-card__icon" aria-hidden="true">◫</span>
        <span class="overview-card__label">累计流量</span>
        <strong class="overview-card__split">
          <span>↑ {{ formatBytes(summary.trafficTransmitted) }}</span>
          <span>↓ {{ formatBytes(summary.trafficReceived) }}</span>
        </strong>
        <span>有数据节点合计</span>
      </article>
    </div>
  </section>
</template>
