<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import DynamicBackground from '@/components/dashboard/DynamicBackground.vue'
import HistoryChart from '@/components/detail/HistoryChart.vue'
import { DEFAULT_PROBE_LABELS } from '@/constants/probes'
import {
  activeProbeTargets,
  buildMetricHistoryCharts,
  buildProbeHistoryCharts,
} from '@/domain/server-detail'
import { HISTORY_HOURS, type HistoryHours } from '@/services/cfsm'
import { useAppStore } from '@/stores/app'
import { useServerDetailStore } from '@/stores/server-detail'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import type { CfsmRequestIssue, ProbeTarget } from '@/types/cfsm'
import {
  formatBytes,
  formatCfsmDate,
  formatCount,
  formatLatency,
  formatLoad,
  formatMebibytes,
  formatPercent,
  formatPrice,
  formatProbePercent,
  formatSpeed,
  formatTimestamp,
  formatUptime,
} from '@/utils/format'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const detail = useServerDetailStore()
const theme = useThemeSettingsStore()
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
  socketState,
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
const metricCharts = computed(() => buildMetricHistoryCharts(historyPoints.value).filter((chart) => (
  chart.key !== 'gpu' || theme.runtime.gpuChartEnabled
)))
const probeCharts = computed(() => buildProbeHistoryCharts(historyPoints.value, labels.value))
const probeTargets = computed(() => (
  server.value ? activeProbeTargets(server.value, historyPoints.value) : []
))
const siteTitle = computed(() => sourceConfig.value?.siteTitle ?? app.config?.siteTitle ?? 'CF Server Monitor')
const pageLoading = computed(() => state.value === 'loading' && server.value === null)
const refreshing = computed(() => state.value === 'loading' || historyState.value === 'loading')
const websocketLabel = computed(() => {
  if (timedOut.value) return '实时连接超时'
  if (paused.value) return '实时更新已暂停'
  if (fallbackActive.value) return 'REST fallback'
  if (socketState.value === 'open') return '单节点实时更新'
  if (socketState.value === 'connecting' || socketState.value === 'backoff') return '实时连接中'
  return 'REST 快照'
})
const resourceItems = computed(() => {
  const current = server.value
  if (!current) return []
  return [
    { key: 'ram', label: 'RAM', used: current.memoryUsed, total: current.memoryTotal, tone: 'emerald' },
    { key: 'swap', label: 'Swap', used: current.swapUsed, total: current.swapTotal, tone: 'violet' },
    { key: 'disk', label: 'Disk', used: current.diskUsed, total: current.diskTotal, tone: 'amber' },
  ]
})
const showPrice = computed(() => {
  const current = server.value
  if (!current) return false
  const authorized = sourceConfig.value?.authorization ?? app.config?.authorization ?? false
  if (theme.runtime.hidePriceWhenLoggedOut && !authorized) return false
  return current.systemConfig?.showPrice !== false
    && (current.price !== null || current.billingCycle !== null || current.currency !== null)
})
const showExpiry = computed(() => {
  const current = server.value
  if (!current) return false
  return current.systemConfig?.showExpire !== false
    && (current.expireDate !== null || current.autoRenewal !== null)
})
const showTrafficPolicy = computed(() => {
  const current = server.value
  if (!current) return false
  return current.systemConfig?.showTraffic !== false
    && (current.trafficLimit !== null || current.trafficCalculationType !== null
      || current.resetDay !== null)
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

function resourcePercentage(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0 || used < 0) return null
  return Math.min(Math.max((used / total) * 100, 0), 100)
}

function meterWidth(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '0%'
  return `${Math.min(Math.max(value, 0), 100)}%`
}

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
  if (current.kind === 'not-found') {
    return { title: '节点不存在', body: '目标数据源未返回这个节点，节点可能已被移除或链接无效。' }
  }
  if (current.kind === 'upgrade-required') {
    return { title: '历史数据库需要升级', body: 'CFSM 返回 databaseUpgradeRequired；升级完成前无法读取这段历史。' }
  }
  if (current.kind === 'unavailable') {
    return { title: '服务暂不可用', body: 'CFSM 返回 503。页面不会使用模拟数据代替真实结果。' }
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
      <header class="detail-header">
        <div class="detail-header__inner">
          <button class="detail-back" type="button" @click="router.push({ name: 'home' })">
            <span aria-hidden="true">←</span>
            <span>节点列表</span>
          </button>
          <div class="detail-header__brand">
            <strong>{{ siteTitle }}</strong>
            <span>{{ websocketLabel }}</span>
          </div>
          <div class="detail-header__actions">
            <button class="icon-button" type="button" aria-label="切换主题" @click="theme.cycleTheme">
              <span aria-hidden="true">◐</span>
            </button>
            <button class="icon-button" type="button" aria-label="主题设置" @click="router.push({ name: 'theme-settings' })">
              <span aria-hidden="true">☷</span>
            </button>
            <button
              class="icon-button"
              :class="{ 'is-spinning': refreshing }"
              type="button"
              :disabled="refreshing || !server"
              aria-label="刷新详情与历史"
              @click="refresh"
            >
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        </div>
      </header>

      <main class="detail-page">
        <section v-if="pageLoading" class="detail-loading" aria-label="正在加载节点详情">
          <span class="skeleton detail-loading__hero" />
          <span v-for="index in 8" :key="index" class="skeleton detail-loading__card" />
        </section>

        <section v-else-if="state === 'error'" class="state-panel state-panel--error detail-state" role="alert">
          <span class="state-panel__icon" aria-hidden="true">!</span>
          <h1>{{ issueCopy(issue, 'detail').title }}</h1>
          <p>{{ issueCopy(issue, 'detail').body }}</p>
          <small v-if="issue?.status">HTTP {{ issue.status }} · {{ issue.message }}</small>
          <div class="detail-state__actions">
            <button type="button" @click="loadCurrent">
              重新加载
            </button>
            <button type="button" @click="router.push({ name: 'home' })">
              返回首页
            </button>
          </div>
        </section>

        <template v-else-if="server">
          <section class="detail-hero glass-panel">
            <div class="detail-hero__main">
              <div class="detail-hero__status" :class="server.online ? 'is-online' : 'is-offline'">
                <span class="node-status" :class="server.online ? 'node-status--online' : 'node-status--offline'" />
                {{ server.online ? '在线' : '离线' }}
              </div>
              <span class="eyebrow">SERVER DETAIL</span>
              <h1>{{ server.name }}</h1>
              <p>{{ [server.operatingSystem, server.architecture, server.region].filter(Boolean).join(' · ') || 'CFSM 未返回系统元数据' }}</p>
              <div v-if="server.tags.length" class="tag-row">
                <span v-for="tag in server.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>
            <dl class="detail-hero__facts">
              <div><dt>分组</dt><dd>{{ server.group || '未分组' }}</dd></div>
              <div><dt>数据源</dt><dd>{{ server.source.label }}</dd></div>
              <div><dt>运行时间</dt><dd>{{ formatUptime(server.bootTime) }}</dd></div>
              <div><dt>最后更新</dt><dd>{{ formatTimestamp(server.lastUpdated ?? server.timestamp) }}</dd></div>
            </dl>
          </section>

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

          <section class="detail-section">
            <header class="detail-section__header">
              <div><span class="eyebrow">LIVE METRICS</span><h2>资源状态</h2></div>
              <span>数据来自当前节点</span>
            </header>
            <div class="detail-resource-grid">
              <article class="detail-metric-card glass-panel detail-metric-card--cpu">
                <span>CPU</span>
                <strong>{{ formatPercent(server.cpu) }}</strong>
                <div class="detail-meter">
                  <i :style="{ width: meterWidth(server.cpu) }" />
                </div>
                <small>Load {{ formatLoad(server.load1) }} / {{ formatLoad(server.load5) }} / {{ formatLoad(server.load15) }}</small>
              </article>
              <article v-for="item in resourceItems" :key="item.key" class="detail-metric-card glass-panel" :class="`detail-metric-card--${item.tone}`">
                <span>{{ item.label }}</span>
                <strong>{{ formatPercent(resourcePercentage(item.used, item.total)) }}</strong>
                <div class="detail-meter">
                  <i :style="{ width: meterWidth(resourcePercentage(item.used, item.total)) }" />
                </div>
                <small>{{ formatMebibytes(item.used) }} / {{ formatMebibytes(item.total) }}</small>
              </article>
            </div>
          </section>

          <section class="detail-two-column">
            <article class="detail-info-card glass-panel">
              <header><span class="eyebrow">NETWORK</span><h2>网络与流量</h2></header>
              <div class="detail-network-speed">
                <span><small>实时下载</small><strong class="network-down">↓ {{ formatSpeed(server.networkInSpeed) }}</strong></span>
                <span><small>实时上传</small><strong class="network-up">↑ {{ formatSpeed(server.networkOutSpeed) }}</strong></span>
              </div>
              <dl class="detail-list">
                <div><dt>累计接收</dt><dd>{{ formatBytes(server.networkReceived) }}</dd></div>
                <div><dt>累计发送</dt><dd>{{ formatBytes(server.networkTransmitted) }}</dd></div>
                <div><dt>本月接收</dt><dd>{{ formatBytes(server.monthlyNetworkReceived) }}</dd></div>
                <div><dt>本月发送</dt><dd>{{ formatBytes(server.monthlyNetworkTransmitted) }}</dd></div>
              </dl>
            </article>
            <article class="detail-info-card glass-panel">
              <header><span class="eyebrow">RUNTIME</span><h2>进程与连接</h2></header>
              <div class="runtime-orbs">
                <span><strong>{{ formatCount(server.processes) }}</strong><small>Processes</small></span>
                <span><strong>{{ formatCount(server.tcpConnections) }}</strong><small>TCP</small></span>
                <span><strong>{{ formatCount(server.udpConnections) }}</strong><small>UDP</small></span>
              </div>
              <dl class="detail-list">
                <div><dt>报告间隔</dt><dd>{{ server.reportInterval === null ? '—' : `${server.reportInterval} 秒` }}</dd></div>
                <div><dt>WS 报告间隔</dt><dd>{{ server.websocketReportInterval === null ? '—' : `${server.websocketReportInterval} 秒` }}</dd></div>
              </dl>
            </article>
          </section>

          <section v-if="probeTargets.length" class="detail-section">
            <header class="detail-section__header">
              <div><span class="eyebrow">PROBES</span><h2>Ping / Loss</h2></div>
              <span>旧四线路与 Node 1–4</span>
            </header>
            <div class="probe-detail-grid">
              <article v-for="target in probeTargets" :key="target" class="probe-detail-card glass-panel">
                <span>{{ probeLabel(target) }}</span>
                <strong>{{ formatLatency(server.latency[target]) }}</strong>
                <small>Loss {{ formatProbePercent(server.packetLoss[target]) }}</small>
                <em v-if="server.latency[target] === false && server.packetLoss[target] === false">{{ probeHistoryStatus(target) }}</em>
                <em v-else-if="server.latency[target] === null || server.packetLoss[target] === null">本轮存在超时</em>
              </article>
            </div>
          </section>

          <section v-if="server.diskIo" class="detail-section">
            <header class="detail-section__header">
              <div><span class="eyebrow">DISK IO</span><h2>磁盘 IO</h2></div><span>仅在真实 disk 存在时显示</span>
            </header>
            <div class="detail-stat-grid">
              <article class="glass-panel">
                <span>读取</span><strong>{{ formatSpeed(server.diskIo.readBps) }}</strong>
              </article>
              <article class="glass-panel">
                <span>写入</span><strong>{{ formatSpeed(server.diskIo.writeBps) }}</strong>
              </article>
              <article class="glass-panel">
                <span>读 IOPS</span><strong>{{ formatCount(server.diskIo.readIops) }}</strong>
              </article>
              <article class="glass-panel">
                <span>写 IOPS</span><strong>{{ formatCount(server.diskIo.writeIops) }}</strong>
              </article>
              <article class="glass-panel">
                <span>Await</span><strong>{{ server.diskIo.awaitMs.toFixed(1) }} ms</strong>
              </article>
              <article class="glass-panel">
                <span>Util</span><strong>{{ formatPercent(server.diskIo.utilization) }}</strong>
              </article>
            </div>
          </section>

          <section v-if="server.gpus.length" class="detail-section">
            <header class="detail-section__header">
              <div><span class="eyebrow">GPU</span><h2>图形加速器</h2></div><span>来自 gpu_info</span>
            </header>
            <div class="gpu-detail-grid">
              <article v-for="gpu in server.gpus" :key="gpu.id" class="gpu-detail-card glass-panel">
                <span>{{ gpu.name }}</span><strong>{{ formatPercent(gpu.utilization) }}</strong>
                <div class="detail-meter">
                  <i :style="{ width: meterWidth(gpu.utilization) }" />
                </div>
              </article>
            </div>
          </section>

          <section class="detail-two-column">
            <article class="detail-info-card glass-panel">
              <header><span class="eyebrow">SYSTEM</span><h2>系统信息</h2></header>
              <dl class="detail-list detail-list--wide">
                <div><dt>CPU</dt><dd>{{ server.cpuInfo ?? '—' }}</dd></div>
                <div><dt>核心</dt><dd>{{ formatCount(server.cpuCores) }}</dd></div>
                <div><dt>操作系统</dt><dd>{{ server.operatingSystem ?? '—' }}</dd></div>
                <div><dt>内核</dt><dd>{{ server.kernelVersion ?? '—' }}</dd></div>
                <div><dt>架构</dt><dd>{{ server.architecture ?? '—' }}</dd></div>
                <div><dt>Agent</dt><dd>{{ server.agentVersion ?? '—' }}</dd></div>
                <div><dt>IPv4</dt><dd>{{ server.ipV4Reachable === null ? '未知' : server.ipV4Reachable === '1' ? '可达' : '不可达' }}</dd></div>
                <div><dt>IPv6</dt><dd>{{ server.ipV6Reachable === null ? '未知' : server.ipV6Reachable === '1' ? '可达' : '不可达' }}</dd></div>
              </dl>
            </article>
            <article v-if="showPrice || showExpiry || showTrafficPolicy" class="detail-info-card glass-panel">
              <header><span class="eyebrow">PLAN</span><h2>费用与套餐</h2></header>
              <dl class="detail-list detail-list--wide">
                <div v-if="showPrice">
                  <dt>价格</dt><dd>{{ formatPrice(server.price, server.currency, server.billingCycle) }}</dd>
                </div>
                <div v-if="showExpiry && server.expireDate">
                  <dt>到期日</dt><dd>{{ formatCfsmDate(server.expireDate) }}</dd>
                </div>
                <div v-if="showExpiry && server.autoRenewal">
                  <dt>自动续费</dt><dd>{{ server.autoRenewal === '1' ? '是' : server.autoRenewal === '0' ? '否' : server.autoRenewal }}</dd>
                </div>
                <div v-if="server.trafficLimit">
                  <dt>流量限制</dt><dd>{{ server.trafficLimit }}</dd>
                </div>
                <div v-if="server.trafficCalculationType">
                  <dt>流量计算</dt><dd>{{ server.trafficCalculationType }}</dd>
                </div>
                <div v-if="server.resetDay !== null">
                  <dt>重置日</dt><dd>每月 {{ server.resetDay }} 日</dd>
                </div>
              </dl>
            </article>
          </section>

          <section class="detail-section detail-history">
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
            <div v-else-if="historyState === 'error'" class="history-state glass-panel" role="alert">
              <strong>{{ issueCopy(historyIssue, 'history').title }}</strong>
              <p>{{ issueCopy(historyIssue, 'history').body }}</p>
              <small v-if="historyIssue?.status">HTTP {{ historyIssue.status }} · {{ historyIssue.message }}</small>
              <button type="button" @click="detail.loadHistory(historyHours)">
                重试历史请求
              </button>
            </div>
            <div v-else-if="historyState === 'empty'" class="history-state glass-panel">
              <strong>暂无历史数据</strong>
              <p>CFSM 返回了空数组。页面不会复制当前指标生成伪造趋势。</p>
            </div>
            <div v-else-if="historyState === 'ready' && metricCharts.length + probeCharts.length === 0" class="history-state glass-panel">
              <strong>没有可绘制的数值</strong>
              <p>后端返回了历史行，但其中没有有效的数值序列。</p>
            </div>
            <div v-else class="history-chart-grid">
              <HistoryChart v-for="chart in metricCharts" :key="chart.key" :chart="chart" />
              <HistoryChart v-for="chart in probeCharts" :key="chart.key" :chart="chart" />
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
