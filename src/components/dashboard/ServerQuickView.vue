<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import type { GlassServer } from '@/types/glassmorphism'
import {
  formatBytes,
  formatCount,
  formatLatency,
  formatLoad,
  formatMebibytes,
  formatPercent,
  formatProbePercent,
  formatSpeed,
  formatTimestamp,
  formatUptime,
} from '@/utils/format'

const props = defineProps<{
  open: boolean
  server: GlassServer | null
  favorite: boolean
  showSource: boolean
}>()

const emit = defineEmits<{
  close: []
  toggleFavorite: []
}>()

const resourceItems = computed(() => {
  if (!props.server) return []
  return [
    { label: 'RAM', metric: props.server.memory },
    { label: 'Swap', metric: props.server.swap },
    { label: 'Disk', metric: props.server.disk },
  ]
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) emit('close')
}

watch(() => props.open, (open) => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('has-modal', open)
  if (open) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
}, { immediate: true })

onUnmounted(() => {
  if (typeof document === 'undefined') return
  document.body.classList.remove('has-modal')
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="quick-view">
      <div
        v-if="open && server"
        class="quick-view"
        role="presentation"
        @click.self="emit('close')"
      >
        <section
          class="quick-view__panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`quick-view-${server.key}`"
        >
          <header class="quick-view__header">
            <div class="quick-view__identity">
              <span
                class="node-status"
                :class="server.online ? 'node-status--online' : 'node-status--offline'"
                aria-hidden="true"
              />
              <div>
                <span class="eyebrow">REST 当前快照</span>
                <h2 :id="`quick-view-${server.key}`">
                  {{ server.name }}
                </h2>
              </div>
            </div>
            <div class="quick-view__actions">
              <button
                type="button"
                class="icon-button"
                :class="{ 'is-favorite': favorite }"
                :aria-label="favorite ? '取消收藏节点' : '收藏节点'"
                @click="emit('toggleFavorite')"
              >
                <span aria-hidden="true">{{ favorite ? '★' : '☆' }}</span>
              </button>
              <button type="button" class="icon-button" aria-label="关闭" @click="emit('close')">
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </header>

          <div class="quick-view__body">
            <div class="quick-view__chips">
              <span :class="server.online ? 'is-reachable' : 'is-unreachable'">
                {{ server.online ? '在线' : '离线' }}
              </span>
              <span v-if="server.group">{{ server.group }}</span>
              <span v-if="server.region">{{ server.region }}</span>
              <span v-if="server.operatingSystem">{{ server.operatingSystem }}</span>
              <span v-if="showSource">{{ server.sourceLabel }}</span>
            </div>

            <div v-if="server.tags.length" class="tag-row" aria-label="节点标签">
              <span v-for="tag in server.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>

            <section class="quick-view__metrics" aria-label="当前资源指标">
              <article>
                <span>CPU</span>
                <strong>{{ formatPercent(server.cpu) }}</strong>
                <small>Load {{ formatLoad(server.load.one) }} / {{ formatLoad(server.load.five) }} / {{ formatLoad(server.load.fifteen) }}</small>
              </article>
              <article v-for="item in resourceItems" :key="item.label">
                <span>{{ item.label }}</span>
                <strong>{{ formatPercent(item.metric.percentage) }}</strong>
                <small>{{ formatMebibytes(item.metric.used) }} / {{ formatMebibytes(item.metric.total) }}</small>
              </article>
            </section>

            <section class="quick-view__section">
              <div class="quick-view__section-title">
                <span>网络</span>
                <small>仅显示后端返回值</small>
              </div>
              <div class="quick-view__network">
                <span class="network-down">↓ {{ formatSpeed(server.network.inSpeed) }}</span>
                <span class="network-up">↑ {{ formatSpeed(server.network.outSpeed) }}</span>
                <span>接收 {{ formatBytes(server.network.received) }}</span>
                <span>发送 {{ formatBytes(server.network.transmitted) }}</span>
              </div>
            </section>

            <section v-if="server.latency.length" class="quick-view__section">
              <div class="quick-view__section-title">
                <span>当前延迟 / 丢包</span>
              </div>
              <div class="quick-view__latency">
                <span v-for="metric in server.latency" :key="metric.carrier">
                  <strong>{{ metric.label }}</strong>
                  {{ formatLatency(metric.latency) }} · {{ formatProbePercent(metric.packetLoss) }} Loss
                </span>
              </div>
            </section>

            <section class="quick-view__section">
              <div class="quick-view__section-title">
                <span>系统信息</span>
              </div>
              <dl class="metadata-list">
                <div><dt>CPU</dt><dd>{{ server.cpuInfo ?? '—' }}</dd></div>
                <div><dt>核心</dt><dd>{{ formatCount(server.cpuCores) }}</dd></div>
                <div><dt>架构</dt><dd>{{ server.architecture ?? '—' }}</dd></div>
                <div><dt>内核</dt><dd>{{ server.kernelVersion ?? '—' }}</dd></div>
                <div><dt>Agent</dt><dd>{{ server.agentVersion ?? '—' }}</dd></div>
                <div><dt>运行时间</dt><dd>{{ formatUptime(server.bootTime) }}</dd></div>
                <div><dt>最后更新</dt><dd>{{ formatTimestamp(server.lastUpdated) }}</dd></div>
                <div><dt>IPv4 / IPv6</dt><dd>{{ server.connectivity.ipv4 === null ? '未知' : server.connectivity.ipv4 === '1' ? '可达' : '不可达' }} / {{ server.connectivity.ipv6 === null ? '未知' : server.connectivity.ipv6 === '1' ? '可达' : '不可达' }}</dd></div>
              </dl>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
