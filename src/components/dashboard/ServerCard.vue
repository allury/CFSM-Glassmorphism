<script setup lang="ts">
import { computed } from 'vue'
import type { GlassServer } from '@/types/glassmorphism'
import {
  formatBytes,
  formatCount,
  formatLatency,
  formatLoad,
  formatPercent,
  formatSpeed,
} from '@/utils/format'
import ResourceMeter from './ResourceMeter.vue'

const props = defineProps<{
  server: GlassServer
  showSource: boolean
}>()

const cpuFill = computed(() => ({
  width: (props.server.cpu ?? 0) + '%',
}))
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
</script>

<template>
  <article
    class="server-card"
    :class="{ 'server-card--offline': !server.online }"
  >
    <header class="server-card__header">
      <div class="server-identity">
        <span
          class="node-status"
          :class="server.online ? 'node-status--online' : 'node-status--offline'"
          aria-hidden="true"
        />
        <div>
          <h3>{{ server.name }}</h3>
          <div class="server-meta">
            <span v-if="server.group">{{ server.group }}</span>
            <span v-if="server.region">{{ server.region }}</span>
            <span v-if="server.operatingSystem">{{ server.operatingSystem }}</span>
            <span v-if="showSource">{{ server.sourceLabel }}</span>
          </div>
        </div>
      </div>
      <span
        class="status-pill"
        :class="server.online ? 'status-pill--online' : 'status-pill--offline'"
      >
        {{ server.online ? '在线' : '离线' }}
      </span>
    </header>

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
            :style="cpuFill"
          />
        </div>
      </div>
      <div class="load-metric">
        <span>Load 1 / 5 / 15</span>
        <strong>
          {{ formatLoad(server.load.one) }}
          <i>/</i>
          {{ formatLoad(server.load.five) }}
          <i>/</i>
          {{ formatLoad(server.load.fifteen) }}
        </strong>
      </div>
    </section>

    <section class="resource-grid" aria-label="资源使用">
      <ResourceMeter label="RAM" :metric="server.memory" />
      <ResourceMeter label="Swap" :metric="server.swap" />
      <ResourceMeter label="Disk" :metric="server.disk" />
    </section>

    <section class="network-panel" aria-label="网络">
      <div>
        <span class="metric-kicker">实时速率</span>
        <strong class="network-pair">
          <span class="network-down">↓ {{ formatSpeed(server.network.inSpeed) }}</span>
          <span class="network-up">↑ {{ formatSpeed(server.network.outSpeed) }}</span>
        </strong>
      </div>
      <div v-if="hasTraffic">
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
      v-if="hasRuntimeStats"
      class="runtime-stats"
      aria-label="运行统计"
    >
      <span v-if="server.processes !== null">进程 <strong>{{ formatCount(server.processes) }}</strong></span>
      <span v-if="server.tcpConnections !== null">TCP <strong>{{ formatCount(server.tcpConnections) }}</strong></span>
      <span v-if="server.udpConnections !== null">UDP <strong>{{ formatCount(server.udpConnections) }}</strong></span>
    </section>

    <section
      v-if="server.latency.length > 0"
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
      v-if="server.gpus.length > 0"
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
      v-if="hasReachability || server.cpuInfo || server.architecture"
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
