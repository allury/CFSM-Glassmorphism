<script setup lang="ts">
import type { GlassServer } from '@/types/glassmorphism'
import {
  formatBytes,
  formatCount,
  formatLatency,
  formatLoad,
  formatPercent,
  formatSpeed,
} from '@/utils/format'

defineProps<{
  servers: GlassServer[]
  showSource: boolean
}>()

function firstLatency(server: GlassServer): string {
  const metric = server.latency[0]
  if (!metric) return '—'
  return metric.label + ' ' + formatLatency(metric.latency)
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
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="server in servers"
          :key="server.key"
          :class="{ 'is-offline': !server.online }"
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
            <strong class="table-node-name">{{ server.name }}</strong>
            <span class="table-secondary">
              {{ [server.group, server.region, server.operatingSystem].filter(Boolean).join(' · ') || '无附加信息' }}
            </span>
            <span
              v-if="showSource"
              class="table-secondary"
            >
              {{ server.sourceLabel }}
            </span>
            <span
              v-if="server.tags.length > 0"
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
        </tr>
      </tbody>
    </table>
  </div>
</template>
