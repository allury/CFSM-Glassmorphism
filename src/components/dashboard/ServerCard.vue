<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardViewMode, GlassServer } from '@/types/glassmorphism'
import AppTooltip from '@/components/ui/AppTooltip.vue'
import {
  formatBytes,
  formatCount,
  formatLatency,
  formatLoad,
  formatPercent,
  formatSpeed,
  formatTimestamp,
  formatUptime,
} from '@/utils/format'
import ResourceMeter from './ResourceMeter.vue'

const props = defineProps<{
  server: GlassServer
  showSource: boolean
  density: Exclude<DashboardViewMode, 'list'>
  favorite: boolean
}>()

const emit = defineEmits<{
  open: []
  toggleFavorite: []
}>()

const cpuFill = computed(() => ({
  width: (props.server.cpu ?? 0) + '%',
}))
const cpuTone = computed(() => {
  const cpu = props.server.cpu
  if (cpu === null) return 'neutral'
  if (cpu >= 90) return 'danger'
  if (cpu >= 75) return 'warning'
  return 'normal'
})
const hasRuntimeStats = computed(() => (
  props.server.processes !== null
  || props.server.tcpConnections !== null
  || props.server.udpConnections !== null
))
const hasTraffic = computed(() => (
  props.server.network.received !== null
  || props.server.network.transmitted !== null
  || props.server.network.monthlyReceived !== null
  || props.server.network.monthlyTransmitted !== null
))
const hasReachability = computed(() => (
  props.server.connectivity.ipv4 !== null || props.server.connectivity.ipv6 !== null
))
const metadataTooltip = computed(() => [
  props.server.cpuInfo,
  props.server.kernelVersion ? `Kernel ${props.server.kernelVersion}` : null,
  props.server.agentVersion ? `Agent ${props.server.agentVersion}` : null,
  props.server.lastUpdated ? `更新 ${formatTimestamp(props.server.lastUpdated)}` : null,
].filter((value): value is string => value !== null).join('\n') || '暂无更多系统信息')

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('open')
}
</script>

<template>
  <article
    class="server-card"
    :class="[
      `server-card--${density}`,
      { 'server-card--offline': !server.online },
    ]"
    role="button"
    tabindex="0"
    :aria-label="`查看 ${server.name} 当前快照`"
    @click="emit('open')"
    @keydown="handleKeydown"
  >
    <header class="server-card__header">
      <div class="server-identity">
        <span class="node-status-wrap" aria-hidden="true">
          <span
            class="node-status"
            :class="server.online ? 'node-status--online' : 'node-status--offline'"
          />
          <span
            class="node-status-pulse"
            :class="server.online ? 'node-status-pulse--online' : 'node-status-pulse--offline'"
          />
        </span>
        <div>
          <AppTooltip :content="server.name" placement="bottom">
            <h3>{{ server.name }}</h3>
          </AppTooltip>
          <span class="server-card__uptime">运行 {{ formatUptime(server.bootTime) }}</span>
        </div>
      </div>
      <div class="server-card__actions">
        <AppTooltip :content="favorite ? '取消收藏' : '收藏节点'">
          <button
            type="button"
            class="favorite-button"
            :class="{ 'is-favorite': favorite }"
            :aria-label="favorite ? `取消收藏 ${server.name}` : `收藏 ${server.name}`"
            @click.stop="emit('toggleFavorite')"
            @keydown.stop
          >
            <span aria-hidden="true">{{ favorite ? '★' : '☆' }}</span>
          </button>
        </AppTooltip>
        <span
          class="status-pill"
          :class="server.online ? 'status-pill--online' : 'status-pill--offline'"
        >
          {{ server.online ? '在线' : '离线' }}
        </span>
      </div>
    </header>

    <div class="server-meta">
      <span v-if="server.region">{{ server.region }}</span>
      <span v-if="server.operatingSystem">{{ server.operatingSystem }}</span>
      <span v-if="server.architecture">{{ server.architecture }}</span>
      <span v-if="showSource">{{ server.sourceLabel }}</span>
      <AppTooltip :content="metadataTooltip">
        <button type="button" class="metadata-more" aria-label="系统元数据" @click.stop>
          ···
        </button>
      </AppTooltip>
    </div>

    <div
      v-if="server.tags.length > 0"
      class="tag-row"
      aria-label="节点标签"
    >
      <span
        v-for="tag in server.tags"
        :key="tag"
        class="tag"
      >
        {{ tag }}
      </span>
    </div>

    <section class="primary-metrics" aria-label="主要指标">
      <div class="cpu-metric">
        <div class="cpu-metric__header">
          <span>CPU</span>
          <strong>{{ formatPercent(server.cpu) }}</strong>
        </div>
        <div class="resource-meter__track">
          <span
            class="resource-meter__fill resource-meter__fill--cpu"
            :class="`resource-meter__fill--${cpuTone}`"
            :style="cpuFill"
          />
        </div>
        <span class="cpu-metric__detail">
          Load {{ formatLoad(server.load.one) }} / {{ formatLoad(server.load.five) }} / {{ formatLoad(server.load.fifteen) }}
        </span>
      </div>
      <ResourceMeter label="RAM" :metric="server.memory" />
    </section>

    <section v-if="density !== 'mini'" class="resource-grid" aria-label="资源使用">
      <ResourceMeter label="Disk" :metric="server.disk" />
      <ResourceMeter v-if="density === 'card'" label="Swap" :metric="server.swap" />
    </section>

    <section class="network-panel" aria-label="网络">
      <div>
        <span class="metric-kicker">实时速率</span>
        <strong class="network-pair">
          <span class="network-down">↓ {{ formatSpeed(server.network.inSpeed) }}</span>
          <span class="network-up">↑ {{ formatSpeed(server.network.outSpeed) }}</span>
        </strong>
      </div>
      <div v-if="hasTraffic && density !== 'mini'">
        <span class="metric-kicker">累计流量</span>
        <strong class="network-pair">
          <span>↓ {{ formatBytes(server.network.received) }}</span>
          <span>↑ {{ formatBytes(server.network.transmitted) }}</span>
        </strong>
        <small
          v-if="server.network.monthlyReceived !== null || server.network.monthlyTransmitted !== null"
        >
          本月 ↓ {{ formatBytes(server.network.monthlyReceived) }}
          · ↑ {{ formatBytes(server.network.monthlyTransmitted) }}
        </small>
      </div>
    </section>

    <section
      v-if="hasRuntimeStats && density === 'card'"
      class="runtime-stats"
      aria-label="运行统计"
    >
      <span v-if="server.processes !== null">进程 <strong>{{ formatCount(server.processes) }}</strong></span>
      <span v-if="server.tcpConnections !== null">TCP <strong>{{ formatCount(server.tcpConnections) }}</strong></span>
      <span v-if="server.udpConnections !== null">UDP <strong>{{ formatCount(server.udpConnections) }}</strong></span>
    </section>

    <section
      v-if="server.latency.length > 0 && density !== 'mini'"
      class="latency-grid"
      aria-label="当前延迟与丢包"
    >
      <div
        v-for="metric in server.latency"
        :key="metric.carrier"
        class="latency-chip"
      >
        <strong>{{ metric.label }}</strong>
        <span>{{ formatLatency(metric.latency) }}</span>
        <small>Loss {{ formatPercent(metric.packetLoss) }}</small>
      </div>
    </section>

    <section
      v-if="server.gpus.length > 0 && density === 'card'"
      class="gpu-row"
      aria-label="GPU"
    >
      <span
        v-for="gpu in server.gpus"
        :key="gpu.id"
      >
        {{ gpu.name }}
        <strong>{{ formatPercent(gpu.utilization) }}</strong>
      </span>
    </section>

    <footer
      v-if="density === 'card' && (hasReachability || server.cpuInfo || server.architecture)"
      class="server-card__footer"
    >
      <div class="reachability">
        <span
          v-if="server.connectivity.ipv4 !== null"
          :class="server.connectivity.ipv4 === '1' ? 'is-reachable' : 'is-unreachable'"
        >
          IPv4 {{ server.connectivity.ipv4 === '1' ? '可达' : '不可达' }}
        </span>
        <span
          v-if="server.connectivity.ipv6 !== null"
          :class="server.connectivity.ipv6 === '1' ? 'is-reachable' : 'is-unreachable'"
        >
          IPv6 {{ server.connectivity.ipv6 === '1' ? '可达' : '不可达' }}
        </span>
      </div>
      <span class="system-copy">
        {{ [server.cpuInfo, server.architecture].filter(Boolean).join(' · ') }}
      </span>
    </footer>
  </article>
</template>
