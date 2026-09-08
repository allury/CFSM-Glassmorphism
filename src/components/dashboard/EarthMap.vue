<script setup lang="ts">
import { computed } from 'vue'
import { buildEarthPoints } from '@/domain/advanced-tools'
import type { EarthRenderer } from '@/theme/settings'
import type { GlassServer } from '@/types/glassmorphism'

const props = defineProps<{
  servers: GlassServer[]
  renderer: EarthRenderer
  stopped: boolean
}>()

const emit = defineEmits<{
  select: [server: GlassServer]
}>()

const points = computed(() => buildEarthPoints(props.servers))
const locatedCount = computed(() => points.value.reduce((sum, point) => sum + point.total, 0))
const rendererLabel = computed(() => ({
  realistic: 'Realistic Globe',
  cobe: 'Cobe Matrix',
  tiled: 'Tiled Map',
})[props.renderer])

function markerTitle(index: number): string {
  const point = points.value[index]
  if (!point) return ''
  return `${point.region} · ${point.online}/${point.total} 在线\n${point.servers.map((server) => server.name).join('\n')}`
}
</script>

<template>
  <section class="earth-stage glass-panel" :class="`earth-stage--${renderer}`">
    <header class="earth-stage__header">
      <div>
        <span class="eyebrow">GLOBAL PRESENCE</span>
        <h2>节点地理分布</h2>
        <p>仅将 CFSM region 映射到国家/地区中心，不代表城市或机房精确位置。</p>
      </div>
      <div class="earth-stage__status">
        <span>{{ rendererLabel }}</span>
        <small>{{ locatedCount }}/{{ servers.length }} 个节点可定位</small>
      </div>
    </header>

    <div class="earth-layout">
      <div
        class="earth-viewport"
        :class="{ 'earth-viewport--moving': !stopped && renderer !== 'tiled' }"
        :aria-label="`${rendererLabel} 国家与地区级节点地图`"
      >
        <svg class="earth-silhouette" viewBox="0 0 1000 500" aria-hidden="true">
          <g class="earth-grid-lines">
            <path v-for="x in [125, 250, 375, 500, 625, 750, 875]" :key="`x-${x}`" :d="`M${x} 0V500`" />
            <path v-for="y in [100, 200, 300, 400]" :key="`y-${y}`" :d="`M0 ${y}H1000`" />
          </g>
          <g class="earth-continents">
            <path d="M63 125 118 77l92-11 56 38 40 8 32 48-31 50-57 9-22 52-53 9-34-56-58-25Z" />
            <path d="m243 286 53 18 34 45-8 78-39 58-29-69-27-69Z" />
            <path d="m451 111 55-30 64 19 26 31 64-27 78 16 71 55-25 38-64-2-40 35-24 86-60 77-40-79-50-25-17-68-62-24-27-49Z" />
            <path d="m739 357 49-35 76 19 45 53-24 51-84 1-53-37Z" />
            <path d="m899 158 23-13 19 18-17 17Z" />
          </g>
        </svg>
        <span class="earth-terminator" aria-hidden="true" />
        <button
          v-for="(point, index) in points"
          :key="point.code"
          class="earth-marker"
          :class="{ 'earth-marker--offline': point.online === 0 }"
          :style="{ left: `${point.x}%`, top: `${point.y}%` }"
          type="button"
          :title="markerTitle(index)"
          :aria-label="`${point.region}，${point.online}/${point.total} 在线`"
          @click="point.servers[0] && emit('select', point.servers[0])"
        >
          <i aria-hidden="true" />
          <span>{{ point.code }}<small v-if="point.total > 1">{{ point.total }}</small></span>
        </button>
        <div v-if="points.length === 0" class="earth-empty">
          <strong>暂无可可靠定位的 region</strong>
          <span>地图保持空白，不根据名称、标签或 IP 猜测位置。</span>
        </div>
      </div>

      <aside class="earth-regions" aria-label="已映射地区">
        <div class="earth-regions__summary">
          <strong>{{ points.length }}</strong>
          <span>国家/地区</span>
        </div>
        <button
          v-for="point in points"
          :key="point.code"
          type="button"
          @click="point.servers[0] && emit('select', point.servers[0])"
        >
          <span><i :class="{ 'is-offline': point.online === 0 }" />{{ point.region }}</span>
          <small>{{ point.online }}/{{ point.total }}</small>
        </button>
        <p v-if="locatedCount < servers.length">
          {{ servers.length - locatedCount }} 个节点因 region 缺失或无法可靠识别而未放置标记。
        </p>
      </aside>
    </div>
  </section>
</template>
