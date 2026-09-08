<script setup lang="ts">
import type { GlassServer } from '@/types/glassmorphism'
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

const props = defineProps<{
  servers: GlassServer[]
  showSource: boolean
  favoriteKeys: ReadonlySet<string>
  metadataEnabled: boolean
  metadataFields: string[]
  customTagsVisible: boolean
}>()

const emit = defineEmits<{
  open: [server: GlassServer]
  toggleFavorite: [key: string]
}>()

function firstLatency(server: GlassServer): string {
  const metric = server.latency[0]
  if (!metric) return '—'
  return metric.label + ' ' + formatLatency(metric.latency)
}

function metadataText(server: GlassServer): string {
  const fields = new Set(props.metadataFields)
  return [
    fields.has('group') ? server.group : null,
    fields.has('region') ? server.region : null,
  ].filter(Boolean).join(' · ')
}

function handleRowKeydown(event: KeyboardEvent, server: GlassServer): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('open', server)
}
</script>

<template>
  <div class="server-table-wrap">
    <table class="server-table">
      <thead>
        <tr>
          <th>状态</th>
          <th>节点</th>
          <th>CPU / Load</th>
          <th>RAM / Swap / Disk</th>
          <th>实时速率</th>
          <th>累计流量</th>
          <th>诊断</th>
          <th><span class="sr-only">操作</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="server in servers"
          :key="server.key"
          :class="{ 'is-offline': !server.online }"
          tabindex="0"
          :aria-label="`查看 ${server.name} 当前快照`"
          @click="emit('open', server)"
          @keydown="handleRowKeydown($event, server)"
        >
          <td>
            <span
              class="table-status"
              :class="server.online ? 'table-status--online' : 'table-status--offline'"
            >
              {{ server.online ? '在线' : '离线' }}
            </span>
          </td>
          <td>
            <AppTooltip :content="server.name" placement="bottom">
              <strong class="table-node-name">{{ server.name }}</strong>
            </AppTooltip>
            <span v-if="metadataEnabled && metadataText(server)" class="table-secondary">
              {{ metadataText(server) }}
            </span>
            <span
              v-if="showSource"
              class="table-secondary"
            >
              来源 {{ server.sourceLabel }}
            </span>
            <span class="table-secondary">运行 {{ formatUptime(server.bootTime) }} · 更新 {{ formatTimestamp(server.lastUpdated) }}</span>
            <span
              v-if="metadataEnabled && customTagsVisible && metadataFields.includes('tags') && server.tags.length > 0"
              class="table-tags"
            >
              {{ server.tags.join(' · ') }}
            </span>
          </td>
          <td>
            <strong>{{ formatPercent(server.cpu) }}</strong>
            <span class="table-secondary">
              {{ formatLoad(server.load.one) }} /
              {{ formatLoad(server.load.five) }} /
              {{ formatLoad(server.load.fifteen) }}
            </span>
          </td>
          <td class="resource-cell">
            <span>RAM <strong>{{ formatPercent(server.memory.percentage) }}</strong></span>
            <span>Swap <strong>{{ formatPercent(server.swap.percentage) }}</strong></span>
            <span>Disk <strong>{{ formatPercent(server.disk.percentage) }}</strong></span>
          </td>
          <td>
            <span class="network-down">↓ {{ formatSpeed(server.network.inSpeed) }}</span>
            <span class="network-up">↑ {{ formatSpeed(server.network.outSpeed) }}</span>
          </td>
          <td>
            <span>↓ {{ formatBytes(server.network.received) }}</span>
            <span>↑ {{ formatBytes(server.network.transmitted) }}</span>
          </td>
          <td>
            <strong>{{ firstLatency(server) }}</strong>
            <span class="table-secondary">
              进程 {{ formatCount(server.processes) }}
              · TCP {{ formatCount(server.tcpConnections) }}
              · UDP {{ formatCount(server.udpConnections) }}
            </span>
            <span class="table-secondary">
              IPv4
              {{ server.connectivity.ipv4 === null ? '未知' : server.connectivity.ipv4 === '1' ? '可达' : '不可达' }}
              · IPv6
              {{ server.connectivity.ipv6 === null ? '未知' : server.connectivity.ipv6 === '1' ? '可达' : '不可达' }}
            </span>
          </td>
          <td class="table-actions">
            <button
              type="button"
              class="favorite-button"
              :class="{ 'is-favorite': favoriteKeys.has(server.key) }"
              :aria-label="favoriteKeys.has(server.key) ? `取消收藏 ${server.name}` : `收藏 ${server.name}`"
              @click.stop="emit('toggleFavorite', server.key)"
              @keydown.stop
            >
              <span aria-hidden="true">{{ favoriteKeys.has(server.key) ? '★' : '☆' }}</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
