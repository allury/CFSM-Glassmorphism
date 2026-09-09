<script setup lang="ts">
import { computed } from 'vue'
import type { GlassServer } from '@/types/glassmorphism'
import type { NodeCardSize } from '@/theme/settings'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppProgressThin from '@/components/ui/AppProgressThin.vue'
import { resolveRegionCoordinates } from '@/domain/advanced-tools'
import { daysUntilExpiry, remainingValue, trafficUsage } from '@/domain/theme-presentation'
import { flagUrl, hideMissingFlag } from '@/utils/flags'
import { osDisplayName, osIconUrl } from '@/utils/os-icon'
import {
  formatBytes,
  formatCurrencyValue,
  formatLatency,
  formatLoad,
  formatPercent,
  formatPrice,
  formatProbePercent,
  formatSpeed,
  formatTimestamp,
  formatUptime,
} from '@/utils/format'

/**
 * 对齐 Komari `NodeCard` 的节点卡片。
 *
 * 区块顺序与上游一致：状态点 + 名称 / 收藏 + OS + 旗帜 / 运行与价格芯片 /
 * CPU·内存·硬盘·流量四项进度 / 网速·总流量·剩余或负载三列指标盒 /
 * 延迟与丢包双面板 / 自定义标签 / 离线遮罩。
 *
 * 数据全部来自既有 normalized model，不解析 wire payload，也不补造缺失值。
 */
const props = defineProps<{
  server: GlassServer
  showSource: boolean
  /** 卡片密度直接来自主题设置 `nodeCardSize`，与 Komari 的 NodeCard 一致。 */
  density: NodeCardSize
  favorite: boolean
  highLoadThreshold: number
  /** 主题级价格隐私（未登录隐藏价格）。每台节点自身的 showPrice 仍单独生效。 */
  priceVisible: boolean
}>()

const emit = defineEmits<{
  open: []
  toggleFavorite: []
}>()

const isMini = computed(() => props.density === 'mini')

function tone(percentage: number | null): 'normal' | 'warning' | 'danger' | 'neutral' {
  if (percentage === null) return 'neutral'
  if (percentage >= props.highLoadThreshold) return 'danger'
  if (percentage >= props.highLoadThreshold * 0.8) return 'warning'
  return 'normal'
}

function ratio(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0) return null
  return Math.min(100, Math.max(0, (used / total) * 100))
}

const memoryPercent = computed(() => ratio(props.server.memory.used, props.server.memory.total))
const diskPercent = computed(() => ratio(props.server.disk.used, props.server.disk.total))
// 节点关闭流量展示时不显示配额，避免呈现服务端已隐藏的数据。
const traffic = computed(() => (props.server.showTraffic ? trafficUsage(props.server) : null))

const osName = computed(() => osDisplayName(props.server.operatingSystem))
const regionCode = computed(() => resolveRegionCoordinates(props.server.region)?.code ?? null)

const uptimeText = computed(() => `运行 ${formatUptime(props.server.bootTime)}`)
/**
 * 价格受两层控制：主题级 `hidePriceWhenLoggedOut` 与该节点自身的 `showPrice`。
 * 缺失或无法解析时 formatPrice 返回占位符，此时不生成价格芯片，避免空标签。
 */
const priceText = computed(() => {
  if (!props.priceVisible || !props.server.showPrice) return ''
  const text = formatPrice(props.server.price, props.server.currency, props.server.billingCycle)
  return text === '—' ? '' : text
})
const expireVisible = computed(() => props.server.showExpire && props.server.expireDate !== null)
const expiryInfo = computed(() => {
  const days = daysUntilExpiry(props.server.expireDate)
  if (days === null) return { text: '—', prefix: '', value: '', unit: '', tone: 'neutral' }
  if (days <= 0) return { text: '已过期', prefix: '', value: '', unit: '', tone: 'danger' }
  if (days > 36_500) return { text: '长期', prefix: '', value: '', unit: '', tone: 'neutral' }
  return {
    text: '',
    prefix: '剩余',
    value: String(days),
    unit: '天',
    tone: days <= 5 ? 'danger' : days <= 10 ? 'warning' : 'neutral',
  }
})
const remainingValueText = computed(() => {
  if (!props.priceVisible || !props.server.showPrice) return ''
  const rawPrice = props.server.price?.trim()
  if (!rawPrice) return ''
  const price = Number(rawPrice)
  if (!Number.isFinite(price) || (price < 0 && price !== -1)) return ''
  if (price === 0 || price === -1) return '无'
  return formatCurrencyValue(remainingValue(props.server), props.server.currency)
})
const offlineText = computed(() => (
  props.server.lastUpdated === null ? '尚无上报' : `最后上报 ${formatTimestamp(props.server.lastUpdated)}`
))

const chips = computed(() => {
  const list: string[] = [uptimeText.value]
  if (priceText.value) list.push(priceText.value)
  if (props.showSource) list.push(props.server.sourceLabel)
  return list
})

/*
 * 延迟与丢包柱状图对齐 Komari `useNodePingDisplay`：
 * 柱子一律满高，数值由 signal-1..5 五级颜色表达，而不是由柱子高度表达；
 * 色觉友好模式再叠加 ping-signal-pattern 纹理。
 * 没有采样时渲染 20 根中性占位柱，与上游 EMPTY_PING_BAR_COUNT 一致，
 * 这样丢包为 0 时面板依然是一条完整的柱带，而不是一片空白。
 */
const EMPTY_PING_BAR_COUNT = 20

function latencyToneClass(latency: number): string {
  if (latency <= 60) return 'is-signal-1'
  if (latency <= 100) return 'is-signal-2'
  if (latency <= 160) return 'is-signal-3 ping-signal-pattern-2'
  if (latency <= 200) return 'is-signal-4 ping-signal-pattern-3'
  return 'is-signal-5 ping-signal-pattern-4'
}

function lossToneClass(loss: number): string {
  if (loss <= 1) return 'is-signal-1'
  if (loss <= 3) return 'is-signal-2'
  if (loss <= 6) return 'is-signal-3 ping-signal-pattern-2'
  if (loss <= 9) return 'is-signal-4 ping-signal-pattern-3'
  return 'is-signal-5 ping-signal-pattern-4'
}

interface PingBar {
  key: string
  className: string
}

function emptyBars(metric: string): PingBar[] {
  return Array.from({ length: EMPTY_PING_BAR_COUNT }, (_, index) => ({
    key: `${metric}-empty-${index}`,
    className: 'is-empty',
  }))
}

function buildBars(
  metric: string,
  samples: readonly number[],
  tone: (value: number) => string,
): PingBar[] {
  if (samples.length === 0) return emptyBars(metric)
  return samples.map((value, index) => ({
    key: `${metric}-${index}`,
    className: tone(value),
  }))
}

const latencyBars = computed(() => buildBars(
  'latency',
  props.server.history.latencySamples,
  latencyToneClass,
))
const lossBars = computed(() => buildBars(
  'loss',
  props.server.history.packetLossSamples,
  lossToneClass,
))

const primaryProbe = computed(() => props.server.latency[0] ?? null)

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('open')
}

function hideMissingImage(event: Event): void {
  const target = event.target
  if (target instanceof HTMLImageElement) target.style.display = 'none'
}
</script>

<template>
  <article
    class="node-card"
    :class="[
      `node-card--${density}`,
      { 'node-card--offline': !server.online },
    ]"
    role="button"
    tabindex="0"
    :aria-label="`查看节点 ${server.name} 详情`"
    @click="emit('open')"
    @keydown="handleKeydown"
  >
    <header class="node-card__header">
      <div class="node-card__identity">
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
        <span class="node-card__name" :title="server.name">{{ server.name }}</span>
      </div>
      <div class="node-card__header-extra">
        <button
          type="button"
          class="favorite-button"
          :class="{ 'is-favorite': favorite }"
          :aria-label="favorite ? `取消收藏 ${server.name}` : `收藏 ${server.name}`"
          :title="favorite ? '取消收藏' : '收藏节点'"
          @click.stop="emit('toggleFavorite')"
          @keydown.stop
        >
          <AppIcon :name="favorite ? 'tabler:star-filled' : 'tabler:star'" :size="14" />
        </button>
        <img
          class="node-card__os"
          :src="osIconUrl(server.operatingSystem)"
          :alt="osName"
          :title="server.operatingSystem ?? osName"
          @error="hideMissingImage"
        >
        <img
          v-if="regionCode"
          class="node-card__flag"
          :src="flagUrl(regionCode)"
          :alt="server.region ?? regionCode"
          :title="server.region ?? regionCode"
          @error="hideMissingFlag"
        >
      </div>
    </header>

    <div class="node-card__body">
      <div class="node-card__chips">
        <span v-for="chip in chips" :key="chip" class="node-chip">{{ chip }}</span>
      </div>

      <div class="node-metrics" :class="{ 'node-metrics--mini': isMini }">
        <div class="node-metric">
          <div class="node-metric__head">
            <span class="node-metric__label node-metric__label--cpu">
              <AppIcon name="tabler:cpu" :size="13" /><span>CPU</span>
            </span>
            <span class="node-metric__value">{{ formatPercent(server.cpu) }}</span>
          </div>
          <AppProgressThin :percentage="server.cpu" :status="tone(server.cpu)" />
          <div v-if="!isMini" class="node-metric__hint">
            {{ formatLoad(server.load.one) }}, {{ formatLoad(server.load.five) }}, {{ formatLoad(server.load.fifteen) }}
          </div>
        </div>

        <div class="node-metric">
          <div class="node-metric__head">
            <span class="node-metric__label node-metric__label--memory">
              <AppIcon name="icon-park-outline:memory" :size="13" /><span>内存</span>
            </span>
            <span class="node-metric__value">{{ formatPercent(memoryPercent) }}</span>
          </div>
          <AppProgressThin :percentage="memoryPercent" :status="tone(memoryPercent)" />
          <div class="node-metric__hint">
            {{ formatBytes(server.memory.used === null ? null : server.memory.used * 1024 ** 2) }}
            /
            {{ formatBytes(server.memory.total === null ? null : server.memory.total * 1024 ** 2) }}
          </div>
        </div>

        <div v-if="!isMini" class="node-metric">
          <div class="node-metric__head">
            <span class="node-metric__label node-metric__label--disk">
              <AppIcon name="tabler:server-2" :size="13" /><span>硬盘</span>
            </span>
            <span class="node-metric__value">{{ formatPercent(diskPercent) }}</span>
          </div>
          <AppProgressThin :percentage="diskPercent" :status="tone(diskPercent)" />
          <div class="node-metric__hint">
            {{ formatBytes(server.disk.used === null ? null : server.disk.used * 1024 ** 2) }}
            /
            {{ formatBytes(server.disk.total === null ? null : server.disk.total * 1024 ** 2) }}
          </div>
        </div>

        <div class="node-metric">
          <div class="node-metric__head">
            <span class="node-metric__label node-metric__label--traffic">
              <AppIcon name="tabler:arrows-transfer-up-down" :size="13" /><span>流量</span>
            </span>
            <span class="node-metric__value">
              {{ traffic ? formatPercent(traffic.percent) : '∞' }}
            </span>
          </div>
          <AppProgressThin :percentage="traffic ? traffic.percent : null" :status="tone(traffic ? traffic.percent : null)" />
          <div class="node-metric__hint">
            {{ formatBytes(traffic ? traffic.used : null) }}
            /
            {{ traffic ? formatBytes(traffic.limit) : '∞' }}
          </div>
        </div>
      </div>

      <div class="node-boxes">
        <div class="node-box">
          <span class="node-box__row node-box__row--up">
            <AppIcon name="tabler:chevron-up" :size="11" />
            <span class="node-box__text">{{ formatSpeed(server.network.outSpeed) }}</span>
          </span>
          <span class="node-box__row node-box__row--down">
            <AppIcon name="tabler:chevron-down" :size="11" />
            <span class="node-box__text">{{ formatSpeed(server.network.inSpeed) }}</span>
          </span>
        </div>
        <div class="node-box">
          <span class="node-box__row">
            <AppIcon name="tabler:upload" :size="11" />
            <span class="node-box__text">{{ formatBytes(server.network.transmitted) }}</span>
          </span>
          <span class="node-box__row">
            <AppIcon name="tabler:download" :size="11" />
            <span class="node-box__text">{{ formatBytes(server.network.received) }}</span>
          </span>
        </div>
        <div class="node-box">
          <template v-if="expireVisible">
            <span
              class="node-box__row"
              :class="`node-box__row--${expiryInfo.tone}`"
            >
              <AppIcon name="tabler:calendar-stats" :size="11" />
              <span v-if="expiryInfo.text" class="node-box__text">{{ expiryInfo.text }}</span>
              <template v-else>
                <span class="node-box__fixed-text">{{ expiryInfo.prefix }}</span>
                <span class="node-box__fixed-text node-box__number">{{ expiryInfo.value }}</span>
                <span class="node-box__fixed-text">{{ expiryInfo.unit }}</span>
              </template>
            </span>
            <span v-if="remainingValueText" class="node-box__row">
              <AppIcon name="tabler:coins" :size="11" />
              <span class="node-box__text">{{ remainingValueText }}</span>
            </span>
          </template>
          <template v-else>
            <span class="node-box__row">
              <span class="node-box__text">{{ formatLoad(server.load.one) }}</span>
            </span>
            <span class="node-box__row">
              <span class="node-box__text">
                {{ formatLoad(server.load.five) }} / {{ formatLoad(server.load.fifteen) }}
              </span>
            </span>
          </template>
        </div>
      </div>

      <div v-if="primaryProbe" class="node-probes">
        <div class="node-probe">
          <div class="node-probe__head">
            <span>延迟</span>
            <span class="node-probe__value">{{ formatLatency(primaryProbe.latency) }}</span>
          </div>
          <div
            class="node-probe__bars"
            :style="{ gridTemplateColumns: `repeat(${latencyBars.length}, minmax(0, 1fr))` }"
          >
            <span v-for="bar in latencyBars" :key="bar.key" :class="bar.className" />
          </div>
        </div>
        <div class="node-probe">
          <div class="node-probe__head">
            <span>丢包</span>
            <span class="node-probe__value">{{ formatProbePercent(primaryProbe.packetLoss) }}</span>
          </div>
          <div
            class="node-probe__bars"
            :style="{ gridTemplateColumns: `repeat(${lossBars.length}, minmax(0, 1fr))` }"
          >
            <span v-for="bar in lossBars" :key="bar.key" :class="bar.className" />
          </div>
        </div>
      </div>

      <div v-if="server.tags.length > 0" class="node-tags" aria-label="节点标签">
        <span v-for="tag in server.tags" :key="tag" class="node-tag">{{ tag }}</span>
      </div>

      <div v-if="!server.online" class="node-card__offline" aria-hidden="true">
        <strong>离线</strong>
        <span>{{ offlineText }}</span>
      </div>
    </div>
  </article>
</template>
