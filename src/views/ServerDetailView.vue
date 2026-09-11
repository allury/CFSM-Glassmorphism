<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/dashboard/AppHeader.vue'
import DynamicBackground from '@/components/dashboard/DynamicBackground.vue'
import HistoryChart from '@/components/detail/HistoryChart.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppEmpty from '@/components/ui/AppEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppTabs, { type AppTabItem } from '@/components/ui/AppTabs.vue'
import type { IconName } from '@/constants/icons'
import { resolveRegionCoordinates } from '@/domain/advanced-tools'
import { getCpuBenchmarkRating, getPassMarkCpuLookupUrl } from '@/utils/cpu-benchmark'
import { osIconUrl } from '@/utils/os-icon'
import { useDashboardPreferencesStore } from '@/stores/dashboard-preferences'
import { useServersStore } from '@/stores/servers'
import { flagUrl, hideMissingFlag } from '@/utils/flags'
import { DEFAULT_PROBE_LABELS } from '@/constants/probes'
import {
  activeProbeTargets,
  buildMetricHistoryCharts,
  buildProbeHistoryCharts,
} from '@/domain/server-detail'
import { buildDetailCards, filterChartsBySettings, parseTrafficLimitBytes } from '@/domain/theme-presentation'
import { HISTORY_HOURS, type HistoryHours } from '@/services/cfsm'
import { useAppStore } from '@/stores/app'
import { useServerDetailStore } from '@/stores/server-detail'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { getChartSeriesPalette } from '@/utils/chart-palette'
import type { CfsmRequestIssue, ProbeTarget } from '@/types/cfsm'
import {
  formatCount,
  formatDetailUptime,
  formatDisplayBytes,
  formatDisplayMebibytes,
  formatDisplaySpeed,
  formatLatency,
  formatPercent,
  formatProbePercent,
} from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const detail = useServerDetailStore()
const theme = useThemeSettingsStore()
const preferences = useDashboardPreferencesStore()
const serverStore = useServersStore()
const {
  server,
  sourceConfig,
  historyHours,
  historyPoints,
  state,
  historyState,
  issue,
  historyIssue,
  refreshIssue,
  fallbackActive,
  timedOut,
  paused,
} = storeToRefs(detail)
const mounted = ref(false)

const routeId = computed(() => (
  typeof route.params.id === 'string' ? route.params.id.trim() : ''
))
const requestedSource = computed(() => (
  typeof route.query.source === 'string' ? route.query.source : undefined
))
const labels = computed(() => sourceConfig.value?.probeLabels ?? DEFAULT_PROBE_LABELS)
/*
 * 上游 `LoadChart` / `PingChart` 的做法：调色板由 store 的色觉设置派生，
 * 再作为具体色值传进图表；切换设置时整组序列颜色一起更新。
 */
const chartPalette = computed(() => getChartSeriesPalette(theme.runtime.colorVisionMode === '色觉友好'))
const historyCharts = computed(() => filterChartsBySettings(
  buildMetricHistoryCharts(historyPoints.value, chartPalette.value),
  buildProbeHistoryCharts(historyPoints.value, labels.value, chartPalette.value),
  theme.runtime,
))
const probeTargets = computed(() => (
  server.value ? activeProbeTargets(server.value, historyPoints.value) : []
))
const siteTitle = computed(() => sourceConfig.value?.siteTitle ?? app.config?.siteTitle ?? 'CF Server Monitor')
const pageLoading = computed(() => state.value === 'loading' && server.value === null)
const refreshing = computed(() => state.value === 'loading' || historyState.value === 'loading')
const headerTotal = computed(() => serverStore.servers.length || (server.value ? 1 : 0))
const headerOnline = computed(() => (
  serverStore.servers.length > 0
    ? serverStore.servers.filter((item) => item.online).length
    : server.value?.online ? 1 : 0
))
const sourceCount = computed(() => app.apiBases.length || (sourceConfig.value ? 1 : 0))
const visibleAdminUrl = computed(() => (
  theme.runtime.hideAdminEntryWhenLoggedOut && app.config?.authorization !== true
    ? null
    : app.administrationUrl
))
/*
 * 站点级展示开关只在 `/api/servers` 的顶层 `sysConfig` 里出现，
 * `/api/server` 只返回 `long_history_points`。详情页因此按 owning source
 * 回到 servers store 取站点开关，节点自身若带同名字段仍以节点为准。
 * 不这样做的话，运营方设置的 show_price / show_expire / show_tf 在详情页会完全失效。
 */
const siteVisibility = computed(() => (
  server.value ? serverStore.siteVisibility(server.value.source.base) : undefined
))
/*
 * 站点开关还没拿到时先按「隐藏」处理，等列表响应回来再决定。
 * 反过来（先显示再隐藏）会把运营方明确关掉的价格闪一下，那是真实的信息泄露；
 * 隐藏先行最多是晚一点出现。store 已经加载过（哪怕这个源没返回开关）就按可见处理，
 * 与之前的行为一致。
 */
const siteVisibilityKnown = computed(() => (
  server.value?.systemConfig !== undefined
  || siteVisibility.value !== undefined
  || serverStore.loadedAt !== null
))
function visibilityFlag(flag: 'showPrice' | 'showExpire' | 'showTraffic'): boolean {
  if (!siteVisibilityKnown.value) return false
  return (server.value?.systemConfig?.[flag] ?? siteVisibility.value?.[flag]) !== false
}
const showPrice = computed(() => {
  const current = server.value
  if (!current) return false
  const authorized = sourceConfig.value?.authorization ?? app.config?.authorization ?? false
  if (theme.runtime.hidePriceWhenLoggedOut && !authorized) return false
  return visibilityFlag('showPrice')
    && (current.price !== null || current.billingCycle !== null || current.currency !== null)
})
const showExpiry = computed(() => {
  const current = server.value
  if (!current) return false
  return visibilityFlag('showExpire')
    && (current.expireDate !== null || current.autoRenewal !== null)
})
const showTrafficPolicy = computed(() => {
  const current = server.value
  if (!current) return false
  return visibilityFlag('showTraffic')
    && (current.trafficLimit !== null || current.trafficCalculationType !== null
      || current.resetDay !== null)
})
const detailCards = computed(() => {
  if (!server.value) return []
  return buildDetailCards(server.value, theme.runtime).filter((card) => {
    // 剩余价值同样由价格推导，必须跟随 show_price 一起隐藏。
    if ((card.key === 'nodePrice' || card.key === 'monthlyCost' || card.key === 'remainingValue') && !showPrice.value) return false
    if (card.key === 'remainingTime' && !showExpiry.value) return false
    if (card.key === 'trafficQuota' && !showTrafficPolicy.value) return false
    return true
  })
})
const historyLabels: Record<HistoryHours, string> = {
  0.167: '10 分钟',
  0.5: '30 分钟',
  1: '1 小时',
  6: '6 小时',
  12: '12 小时',
  24: '24 小时',
  48: '2 天',
  96: '4 天',
  168: '7 天',
}
const historyOptions = HISTORY_HOURS.map((value) => ({ value, label: historyLabels[value] }))

/*
 * 与 Komari 详情页顶部工具条一致：收藏 + 上一台 / 节点选择 / 下一台。
 * 导航列表复用首页已经加载的轻量索引（CODEX_SPEC §79），
 * 详情页本身仍只订阅当前单节点，不会为了导航而订阅全量 WebSocket。
 */
const detailNodes = computed(() => serverStore.servers)
const currentNodeIndex = computed(() => detailNodes.value.findIndex(
  (item) => item.id === server.value?.id && item.source.base === server.value?.source.base,
))
const canNavigateNodes = computed(() => detailNodes.value.length > 1 && currentNodeIndex.value >= 0)
const favoriteKey = computed(() => (
  server.value ? `${server.value.source.base}::${server.value.id}` : null
))
const isFavorite = computed(() => (
  favoriteKey.value !== null && preferences.isFavorite(favoriteKey.value)
))
const regionCode = computed(() => resolveRegionCoordinates(server.value?.region ?? null)?.code ?? null)

function toggleFavorite(): void {
  if (favoriteKey.value) preferences.toggleFavorite(favoriteKey.value)
}

function openNode(target: { id: string, source: { base: string } } | undefined): void {
  if (!target) return
  void router.push({
    name: 'server-detail',
    params: { id: target.id },
    query: { source: target.source.base },
  })
}

function navigateNode(step: number): void {
  if (!canNavigateNodes.value) return
  const size = detailNodes.value.length
  const next = (currentNodeIndex.value + step + size) % size
  openNode(detailNodes.value[next])
}

function selectNode(event: Event): void {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : ''
  openNode(detailNodes.value.find((item) => `${item.source.base}::${item.id}` === value))
}

function hideMissingImage(event: Event): void {
  const target = event.target
  if (target instanceof HTMLImageElement) target.style.display = 'none'
}

function meterWidth(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '0%'
  return `${Math.min(Math.max(value, 0), 100)}%`
}

/*
 * 详情分区 Tab。上游 `InstanceDetail` 在 `nodeDetailSectionTabsEnabled` 打开时
 * 把页面切成 概览 / 负载 / 延迟 三段：概览是指标卡与四张信息卡，
 * 负载是 LoadChart，延迟是 PingChart。关闭时全部堆叠显示（上游默认关闭）。
 * CFSM 的历史区同时承载指标图与探针图，因此按图表 key 拆分到对应分区，
 * 探针当前值卡片跟随「延迟」，磁盘 IO 与 GPU 属于「概览」。
 */
const DETAIL_SECTIONS: readonly AppTabItem[] = [
  { value: 'overview', label: '概览', icon: 'tabler:layout-dashboard' },
  { value: 'load', label: '负载', icon: 'tabler:activity' },
  { value: 'ping', label: '延迟', icon: 'tabler:timeline' },
]
const detailSections = DETAIL_SECTIONS
const activeSection = ref('overview')
const sectionTabs = computed(() => theme.runtime.nodeDetailSectionTabsEnabled)
const overviewVisible = computed(() => !sectionTabs.value || activeSection.value === 'overview')
const pingVisible = computed(() => !sectionTabs.value || activeSection.value === 'ping')
const PROBE_CHART_KEYS = new Set(['ping', 'loss'])
const loadCharts = computed(() => historyCharts.value.filter((chart) => !PROBE_CHART_KEYS.has(chart.key)))
const pingCharts = computed(() => historyCharts.value.filter((chart) => PROBE_CHART_KEYS.has(chart.key)))
const visibleHistoryCharts = computed(() => {
  if (!sectionTabs.value) return historyCharts.value
  return activeSection.value === 'ping' ? pingCharts.value : loadCharts.value
})
const historyVisible = computed(() => !sectionTabs.value || activeSection.value !== 'overview')

watch(() => server.value?.id, () => {
  activeSection.value = 'overview'
})

/*
 * 硬件卡的 CPU 块，逐项对应上游：型号 + vCPU 数、PassMark 外链、近似分级条。
 * 分级只读取 CPU 型号字符串，不引入 CFSM 之外的数据。
 */
const cpuName = computed(() => server.value?.cpuInfo?.trim() ?? '')
const cpuText = computed(() => {
  const name = cpuName.value || '—'
  const cores = server.value?.cpuCores
  return cores === null || cores === undefined ? name : `${name} (${formatCount(cores)} vCPU)`
})
const cpuBenchmarkUrl = computed(() => getPassMarkCpuLookupUrl(cpuName.value))
const cpuBenchmarkRating = computed(() => getCpuBenchmarkRating(cpuName.value))
const CPU_TIER_PERCENT: Record<string, number> = { S: 92, A: 76, B: 58, C: 38, D: 20, '?': 0 }
const cpuTierPercent = computed(() => CPU_TIER_PERCENT[cpuBenchmarkRating.value.tier] ?? 0)
const cpuTierTitle = computed(() => (
  `参考公开天梯与型号代际的本地近似分级，不代表当前 ${formatCount(server.value?.cpuCores ?? null)} vCPU 的实测性能。${cpuBenchmarkRating.value.description}`
))

interface InfoItem {
  label: string
  value: string
  icon: IconName
}

/*
 * 上游硬件小格共四项：IP（或架构）、物理核心数、虚拟机类型、GPU。
 * CFSM 的 `ip_v4` / `ip_v6` 只是可达性标志，也不提供物理核心数与虚拟机类型字段，
 * 因此前三项里只保留架构；补上 CFSM 真实提供的 Agent 版本，GPU 仍按存在与否显示。
 */
const hardwareItems = computed<InfoItem[]>(() => {
  const current = server.value
  if (!current) return []
  const items: InfoItem[] = [
    { label: '架构', value: current.architecture ?? '-', icon: 'icon-park-outline:application-two' },
    { label: 'Agent', value: current.agentVersion ?? '-', icon: 'icon-park-outline:server' },
  ]
  const gpuNames = current.gpus.map((gpu) => gpu.name.trim()).filter(Boolean)
  if (gpuNames.length > 0) {
    items.push({ label: 'GPU', value: gpuNames.join(' / '), icon: 'icon-park-outline:video-one' })
  }
  return items
})

const systemItems = computed<InfoItem[]>(() => {
  const current = server.value
  if (!current) return []
  return [
    { label: '操作系统', value: current.operatingSystem ?? '-', icon: 'icon-park-outline:computer' },
    { label: '内核版本', value: current.kernelVersion ?? '-', icon: 'icon-park-outline:code' },
    { label: '运行时间', value: formatDetailUptime(current.bootTime), icon: 'icon-park-outline:timer' },
    { label: '数据源', value: current.source.label, icon: 'icon-park-outline:server' },
  ]
})

const storageItems = computed<InfoItem[]>(() => {
  const current = server.value
  if (!current) return []
  return [
    { label: '内存', value: formatDisplayMebibytes(current.memoryTotal), icon: 'icon-park-outline:memory' },
    { label: '内存交换', value: formatDisplayMebibytes(current.swapTotal), icon: 'icon-park-outline:switch' },
    { label: '硬盘', value: formatDisplayMebibytes(current.diskTotal), icon: 'icon-park-outline:hard-disk' },
  ]
})

/*
 * 网络卡的总流量块。上游按 `traffic_limit_type` 选口径并把使用率画成背景进度条；
 * CFSM 的口径字段是 `traffic_calculation_type`，含义相同。
 * 没有可靠配额时显示「无限流量」，不猜一个上限。
 */
const trafficQuota = computed<{ used: number, limit: number, percent: number } | null>(() => {
  const current = server.value
  if (!current || !showTrafficPolicy.value) return null
  const limit = parseTrafficLimitBytes(current.trafficLimit)
  const received = current.monthlyNetworkReceived
  const transmitted = current.monthlyNetworkTransmitted
  if (limit === null || (received === null && transmitted === null)) return null
  const calculation = current.trafficCalculationType?.toLowerCase()
  const used = calculation === 'dl' ? (received ?? 0)
    : calculation === 'ul' ? (transmitted ?? 0)
      : calculation === 'max' ? Math.max(received ?? 0, transmitted ?? 0)
        : (received ?? 0) + (transmitted ?? 0)
  return { used, limit, percent: Math.min(100, (used / limit) * 100) }
})
const trafficUsageText = computed(() => {
  const quota = trafficQuota.value
  if (!quota) return '无限流量'
  return `${formatDisplayBytes(quota.used)} / ${formatDisplayBytes(quota.limit)}`
})
const trafficProgressTone = computed(() => {
  const percent = trafficQuota.value?.percent ?? 0
  if (percent >= 80) return 'is-danger'
  if (percent >= 60) return 'is-warning'
  return 'is-ok'
})

function issueCopy(current: CfsmRequestIssue | null, context: 'detail' | 'history'): {
  title: string
  body: string
} {
  if (!current) return { title: '请求失败', body: '无法读取 CFSM 数据。' }
  if (current.kind === 'unauthorized') {
    return {
      title: '需要登录授权',
      body: context === 'history'
        ? '当前时间范围需要有效的 CFSM 登录状态。请登录后重试，现有节点快照不会被替换。'
        : '此节点需要有效的 CFSM 登录状态才能查看。',
    }
  }
  if (current.kind === 'forbidden') {
    return {
      title: '访问被拒绝',
      body: 'CFSM 返回 403。Turnstile 或当前登录权限需要重新验证，现有真实快照会保留。',
    }
  }
  if (current.kind === 'not-found') {
    return { title: '节点不存在', body: '目标数据源未返回这个节点，节点可能已被移除或链接无效。' }
  }
  if (current.kind === 'upgrade-required') {
    return { title: '历史数据库需要升级', body: 'CFSM 返回 databaseUpgradeRequired；升级完成前无法读取这段历史。' }
  }
  if (current.kind === 'unavailable') {
    return { title: '服务暂不可用', body: 'CFSM 返回 503。页面不会使用模拟数据代替真实结果。' }
  }
  if (current.kind === 'server-error') {
    return { title: '服务端请求失败', body: `CFSM 返回 HTTP ${current.status ?? '5xx'}。请稍后重试，页面不会生成替代数据。` }
  }
  if (current.kind === 'network') {
    return { title: '网络请求失败', body: '无法连接所属 CFSM 数据源，请检查网络后重试。' }
  }
  if (current.kind === 'invalid-request') {
    return { title: '请求参数无效', body: 'CFSM 拒绝了当前节点或时间范围参数。' }
  }
  return { title: '读取失败', body: current.message }
}

function probeLabel(target: ProbeTarget): string {
  return labels.value[target]
}

function probeHistoryStatus(target: ProbeTarget): string {
  const values = historyPoints.value.flatMap((point) => [
    point.latency[target],
    point.packetLoss[target],
  ])
  const valid = values.filter((value) => typeof value === 'number').length
  const timedOutValues = values.filter((value) => value === null).length
  if (valid === 0 && timedOutValues > 0) return `历史仅含 ${timedOutValues} 个超时点`
  if (valid > 0) return `历史含 ${valid} 个有效值`
  return '未配置或未上报'
}

async function loadCurrent(): Promise<void> {
  if (!mounted.value || routeId.value === '') return
  if (app.apiBases.length === 0) await app.initialize()
  await detail.open(routeId.value, app.apiBases, requestedSource.value)
}

async function refresh(): Promise<void> {
  await detail.refresh()
}

function selectHistory(hours: HistoryHours): void {
  void detail.loadHistory(hours)
}

onMounted(async () => {
  if (app.state === 'idle') await app.initialize()
  mounted.value = true
  await loadCurrent()
  /*
   * 站点级 show_price / show_expire / show_tf 只出现在 `/api/servers` 的顶层
   * `sysConfig`，`/api/server` 没有。从首页点进来时 store 里已经有这份数据，
   * 但直接粘贴详情链接冷启动时没有，运营方隐藏的价格 / 到期 / 流量会照常显示。
   *
   * 这里补一次**已有的**列表请求（首页用的同一个 store action、同一个端点），
   * 不新增请求形态，也不轮询：只在 store 为空时触发一次。
   * 顺带把顶部的上一台 / 选择器 / 下一台在冷启动时也补齐。
   */
  if (serverStore.collections.length === 0) await serverStore.load()
})

watch([routeId, requestedSource], () => {
  if (mounted.value) void loadCurrent()
})

watch([server, siteTitle], () => {
  document.title = server.value ? `${server.value.name} · ${siteTitle.value}` : siteTitle.value
}, { immediate: true })

onUnmounted(() => detail.close())
</script>

<template>
  <div class="app-root detail-root">
    <DynamicBackground />
    <div class="app-shell">
      <AppHeader
        :title="siteTitle"
        :version="sourceConfig?.version ?? app.config?.version ?? null"
        :loading="refreshing"
        :online="headerOnline"
        :total="headerTotal"
        :source-count="sourceCount"
        :admin-url="visibleAdminUrl"
        :theme-mode="theme.runtime.themeMode"
        @refresh="refresh"
        @cycle-theme="theme.cycleTheme"
      />

      <main class="detail-page">
        <section v-if="pageLoading" class="detail-loading" aria-label="正在加载节点详情">
          <span class="skeleton detail-loading__hero" />
          <span v-for="index in 8" :key="index" class="skeleton detail-loading__card" />
        </section>

        <section v-else-if="state === 'error'" class="state-panel state-panel--error detail-state" role="alert">
          <AppEmpty
            tone="error"
            :title="issueCopy(issue, 'detail').title"
            :description="issueCopy(issue, 'detail').body"
          >
            <template #icon>
              <AppIcon name="lucide:octagon-x" :size="20" />
            </template>
            <template #extra>
              <small v-if="issue?.status">HTTP {{ issue.status }} · {{ issue.message }}</small>
              <div class="detail-state__actions">
                <button type="button" @click="loadCurrent">
                  重新加载
                </button>
                <button type="button" @click="router.push({ name: 'home' })">
                  返回首页
                </button>
              </div>
            </template>
          </AppEmpty>
        </section>

        <template v-else-if="server">
          <div class="detail-topbar">
            <button
              type="button"
              class="icon-button"
              aria-label="返回首页"
              title="返回首页"
              @click="router.push({ name: 'home' })"
            >
              <AppIcon name="tabler:arrow-left" :size="16" />
            </button>

            <div class="detail-topbar__identity">
              <img
                v-if="regionCode"
                class="detail-topbar__flag"
                :src="flagUrl(regionCode)"
                :alt="server.region ?? regionCode"
                @error="hideMissingFlag"
              >
              <span class="detail-topbar__name" :title="server.name">{{ server.name }}</span>
            </div>

            <AppBadge :variant="server.online ? 'default' : 'destructive'">
              {{ server.online ? '在线' : '离线' }}
            </AppBadge>

            <div v-if="server.tags.length" class="detail-topbar__tags">
              <AppBadge v-for="tag in server.tags" :key="tag" variant="outline">
                {{ tag }}
              </AppBadge>
            </div>

            <div class="detail-topbar__tools">
              <button
                type="button"
                class="icon-button favorite-button"
                :class="{ 'is-favorite': isFavorite }"
                :aria-label="isFavorite ? '取消收藏当前节点' : '收藏当前节点'"
                :title="isFavorite ? '取消收藏' : '收藏节点'"
                @click="toggleFavorite"
              >
                <AppIcon :name="isFavorite ? 'tabler:star-filled' : 'tabler:star'" :size="14" />
              </button>
              <button
                type="button"
                class="icon-button"
                :disabled="!canNavigateNodes"
                aria-label="上一个节点"
                title="上一个节点"
                @click="navigateNode(-1)"
              >
                <AppIcon name="tabler:chevron-left" :size="14" />
              </button>
              <select
                v-if="canNavigateNodes"
                class="detail-topbar__select"
                :value="favoriteKey ?? undefined"
                aria-label="切换节点"
                @change="selectNode"
              >
                <option v-for="node in detailNodes" :key="`${node.source.base}::${node.id}`" :value="`${node.source.base}::${node.id}`">
                  {{ node.name }}
                </option>
              </select>
              <button
                type="button"
                class="icon-button"
                :disabled="!canNavigateNodes"
                aria-label="下一个节点"
                title="下一个节点"
                @click="navigateNode(1)"
              >
                <AppIcon name="tabler:chevron-right" :size="14" />
              </button>
            </div>
          </div>

          <div v-if="timedOut" class="notice notice--warning notice--choice" role="status">
            <div><strong>单节点实时连接已达到站点时限</strong><span>请选择继续连接，或保留当前真实快照。</span></div>
            <div class="notice__actions">
              <button type="button" @click="detail.continueAfterTimeout">
                继续实时连接
              </button>
              <button type="button" @click="detail.pauseAfterTimeout">
                保持暂停
              </button>
            </div>
          </div>
          <div v-else-if="paused" class="notice notice--warning notice--choice" role="status">
            <div><strong>详情实时更新已暂停</strong><span>恢复时仍只会订阅当前节点。</span></div>
            <div class="notice__actions">
              <button type="button" @click="detail.resume">
                恢复
              </button>
            </div>
          </div>
          <div v-if="fallbackActive" class="notice notice--warning" role="status">
            <strong>单节点 WebSocket 暂不可用</strong>
            <span>已启用低频 /api/server REST 补偿，不会订阅其他节点。</span>
          </div>
          <div v-if="refreshIssue" class="notice notice--warning" role="status">
            <strong>{{ issueCopy(refreshIssue, 'detail').title }}</strong>
            <span>{{ issueCopy(refreshIssue, 'detail').body }}</span>
          </div>

          <div v-if="theme.runtime.nodeDetailSectionTabsEnabled" class="detail-tabs-bar">
            <AppTabs
              v-model="activeSection"
              list-label="详情分区"
              :items="detailSections"
            />
          </div>

          <section v-if="overviewVisible" class="detail-overview" aria-label="节点指标概览">
            <div class="detail-resource-grid">
              <article
                v-for="card in detailCards"
                :key="card.key"
                class="detail-metric-card"
                :class="`detail-metric-card--${card.key}`"
                :title="card.hint || undefined"
              >
                <span class="detail-metric-card__head">
                  <span class="detail-metric-card__label">{{ card.label }}</span>
                  <AppIcon :name="card.icon" :size="20" />
                </span>
                <span class="detail-metric-card__value" :class="card.tone ? `is-${card.tone}` : undefined">
                  <strong>{{ card.value }}</strong>
                  <em v-if="card.unit">{{ card.unit }}</em>
                </span>
              </article>
            </div>
          </section>

          <section v-if="overviewVisible" class="detail-information-grid" aria-label="节点基础信息">
            <article class="detail-info-card detail-info-card--hardware">
              <header><h2>硬件信息</h2></header>
              <div class="detail-info-card__body">
                <div class="detail-fact detail-fact--cpu">
                  <span class="detail-fact__head">
                    <span><AppIcon name="icon-park-outline:cpu" :size="14" />CPU</span>
                    <a
                      class="detail-cpu-link"
                      :href="cpuBenchmarkUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="在 PassMark 查看该 CPU 的公开 CPU Mark 跑分与排行"
                    >
                      <AppIcon name="tabler:chart-bar" :size="13" />
                      <span class="detail-cpu-link__long">CPU Mark 排行</span>
                      <span class="detail-cpu-link__short">CPU Mark</span>
                      <AppIcon name="tabler:external-link" :size="11" />
                    </a>
                  </span>
                  <strong>{{ cpuText }}</strong>
                  <div class="detail-cpu-tier" :title="cpuTierTitle">
                    <span class="detail-cpu-tier__letter" :class="`is-tier-${cpuBenchmarkRating.tier}`">
                      {{ cpuBenchmarkRating.tier }}
                    </span>
                    <div class="detail-cpu-tier__bar">
                      <i :class="`is-tier-${cpuBenchmarkRating.tier}`" :style="{ width: `${cpuTierPercent}%` }" />
                    </div>
                    <span class="detail-cpu-tier__label">{{ cpuBenchmarkRating.label }}</span>
                  </div>
                </div>
                <div class="detail-fact-grid" :class="hardwareItems.length <= 2 ? 'is-two' : 'is-three'">
                  <div v-for="item in hardwareItems" :key="item.label" class="detail-fact">
                    <span><AppIcon :name="item.icon" :size="14" />{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </div>
            </article>

            <article class="detail-info-card detail-info-card--system">
              <header><h2>系统信息</h2></header>
              <div class="detail-fact-grid">
                <div v-for="item in systemItems" :key="item.label" class="detail-fact">
                  <span><AppIcon :name="item.icon" :size="14" />{{ item.label }}</span>
                  <strong>
                    <img
                      v-if="item.label === '操作系统'"
                      class="detail-fact__os"
                      :src="osIconUrl(server.operatingSystem)"
                      :alt="server.operatingSystem ?? '操作系统'"
                      @error="hideMissingImage"
                    >
                    <span>{{ item.value }}</span>
                  </strong>
                </div>
              </div>
            </article>

            <article class="detail-info-card detail-info-card--storage">
              <header><h2>存储信息</h2></header>
              <div class="detail-storage-grid">
                <div v-for="item in storageItems" :key="item.label" class="detail-fact">
                  <span><AppIcon :name="item.icon" :size="14" />{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </article>

            <article class="detail-info-card detail-info-card--network">
              <header><h2>网络信息</h2></header>
              <div class="detail-network-grid">
                <div class="detail-network-card">
                  <i
                    v-if="trafficQuota"
                    class="detail-network-card__progress"
                    :class="trafficProgressTone"
                    :style="{ width: meterWidth(trafficQuota.percent) }"
                    aria-hidden="true"
                  />
                  <span class="detail-network-card__head">
                    <span><AppIcon name="icon-park-outline:transfer-data" :size="14" />总流量</span>
                    <span class="detail-network-card__protocols">
                      <AppBadge v-if="server.ipV4Reachable === '1'" variant="outline">IPv4</AppBadge>
                      <AppBadge v-if="server.ipV6Reachable === '1'" variant="outline">IPv6</AppBadge>
                    </span>
                    <small>{{ formatDisplayBytes(server.networkTransmitted) }} / {{ formatDisplayBytes(server.networkReceived) }}</small>
                  </span>
                  <strong>{{ trafficUsageText }}</strong>
                </div>
                <div class="detail-network-card">
                  <span class="detail-network-card__head">
                    <span><AppIcon name="icon-park-outline:dashboard-one" :size="14" />网络速率</span>
                  </span>
                  <strong class="detail-network-card__rates">
                    <span class="network-up"><AppIcon name="tabler:chevron-up" :size="12" />{{ formatDisplaySpeed(server.networkOutSpeed) }}</span>
                    <span class="network-down"><AppIcon name="tabler:chevron-down" :size="12" />{{ formatDisplaySpeed(server.networkInSpeed) }}</span>
                  </strong>
                </div>
              </div>
            </article>
          </section>

          <section v-if="pingVisible && probeTargets.length" class="detail-section">
            <header class="detail-section__header">
              <div><span class="eyebrow">PROBES</span><h2>Ping / Loss</h2></div>
              <span>旧四线路与 Node 1–4</span>
            </header>
            <div class="probe-detail-grid">
              <article v-for="target in probeTargets" :key="target" class="probe-detail-card">
                <span>{{ probeLabel(target) }}</span>
                <strong>{{ formatLatency(server.latency[target]) }}</strong>
                <small>Loss {{ formatProbePercent(server.packetLoss[target]) }}</small>
                <em v-if="server.latency[target] === false && server.packetLoss[target] === false">{{ probeHistoryStatus(target) }}</em>
                <em v-else-if="server.latency[target] === null || server.packetLoss[target] === null">本轮存在超时</em>
              </article>
            </div>
          </section>

          <section v-if="overviewVisible && server.diskIo" class="detail-section">
            <header class="detail-section__header">
              <div><span class="eyebrow">DISK IO</span><h2>磁盘 IO</h2></div><span>仅在真实 disk 存在时显示</span>
            </header>
            <div class="detail-stat-grid">
              <article>
                <span>读取</span><strong>{{ formatDisplaySpeed(server.diskIo.readBps) }}</strong>
              </article>
              <article>
                <span>写入</span><strong>{{ formatDisplaySpeed(server.diskIo.writeBps) }}</strong>
              </article>
              <article>
                <span>读 IOPS</span><strong>{{ formatCount(server.diskIo.readIops) }}</strong>
              </article>
              <article>
                <span>写 IOPS</span><strong>{{ formatCount(server.diskIo.writeIops) }}</strong>
              </article>
              <article>
                <span>Await</span><strong>{{ server.diskIo.awaitMs.toFixed(1) }} ms</strong>
              </article>
              <article>
                <span>Util</span><strong>{{ formatPercent(server.diskIo.utilization) }}</strong>
              </article>
            </div>
          </section>

          <section v-if="overviewVisible && server.gpus.length" class="detail-section">
            <header class="detail-section__header">
              <div><span class="eyebrow">GPU</span><h2>图形加速器</h2></div><span>来自 gpu_info</span>
            </header>
            <div class="gpu-detail-grid">
              <article v-for="gpu in server.gpus" :key="gpu.id" class="gpu-detail-card">
                <span>{{ gpu.name }}</span><strong>{{ formatPercent(gpu.utilization) }}</strong>
                <div class="detail-meter">
                  <i :style="{ width: meterWidth(gpu.utilization) }" />
                </div>
              </article>
            </div>
          </section>

          <section v-if="historyVisible" class="detail-section detail-history">
            <header class="detail-section__header detail-history__header">
              <div><span class="eyebrow">HISTORY</span><h2>历史趋势</h2><p>只展示 /api/history/all 返回的真实采样。</p></div>
              <div class="history-range" aria-label="历史时间范围">
                <button
                  v-for="option in historyOptions"
                  :key="option.value"
                  type="button"
                  :class="{ 'is-active': historyHours === option.value }"
                  :disabled="historyState === 'loading'"
                  @click="selectHistory(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </header>

            <div v-if="historyState === 'loading'" class="history-loading">
              <span v-for="index in 4" :key="index" class="skeleton" />
            </div>
            <div v-else-if="historyState === 'error'" class="history-state" role="alert">
              <strong>{{ issueCopy(historyIssue, 'history').title }}</strong>
              <p>{{ issueCopy(historyIssue, 'history').body }}</p>
              <small v-if="historyIssue?.status">HTTP {{ historyIssue.status }} · {{ historyIssue.message }}</small>
              <button type="button" @click="detail.loadHistory(historyHours)">
                重试历史请求
              </button>
            </div>
            <div v-else-if="historyState === 'empty'" class="history-state">
              <strong>暂无历史数据</strong>
              <p>CFSM 返回了空数组。页面不会复制当前指标生成伪造趋势。</p>
            </div>
            <div v-else-if="historyState === 'ready' && visibleHistoryCharts.length === 0" class="history-state">
              <strong>没有可绘制的数值</strong>
              <p>后端返回了历史行，但其中没有有效的数值序列。</p>
            </div>
            <div v-else class="history-chart-grid">
              <HistoryChart v-for="chart in visibleHistoryCharts" :key="chart.key" :chart="chart" />
            </div>
          </section>
        </template>
      </main>

      <footer class="app-footer">
        <span>Powered by <a href="https://github.com/huilang-me/CF-Server-Monitor/">CF-Server-Monitor<template v-if="sourceConfig?.version"> v{{ sourceConfig.version }}</template></a></span>
        <span>Glassmorphism Theme · Server Detail</span>
      </footer>
    </div>
  </div>
</template>
