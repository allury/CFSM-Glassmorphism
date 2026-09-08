<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/dashboard/AppHeader.vue'
import DashboardControls from '@/components/dashboard/DashboardControls.vue'
import DynamicBackground from '@/components/dashboard/DynamicBackground.vue'
import OverviewCards from '@/components/dashboard/OverviewCards.vue'
import ServerCard from '@/components/dashboard/ServerCard.vue'
import ServerList from '@/components/dashboard/ServerList.vue'
import ServerQuickView from '@/components/dashboard/ServerQuickView.vue'
import {
  ALL_GROUPS,
  availableGroups,
  filterServers,
  groupServers,
  sortServers,
  summarizeServers,
} from '@/domain/dashboard'
import { toGlassServer } from '@/services/cfsm'
import { useAppStore } from '@/stores/app'
import { useDashboardPreferencesStore } from '@/stores/dashboard-preferences'
import { useRealtimeStore } from '@/stores/realtime'
import { useServersStore } from '@/stores/servers'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { parseSettingKeys } from '@/theme/settings'
import type { DashboardSort, DashboardViewMode, GlassServer } from '@/types/glassmorphism'

const app = useAppStore()
const serverStore = useServersStore()
const preferences = useDashboardPreferencesStore()
const realtime = useRealtimeStore()
const theme = useThemeSettingsStore()
const router = useRouter()

const query = ref('')
const selectedGroup = ref(ALL_GROUPS)
const sort = ref<DashboardSort>('order')
const refreshing = ref(false)
const favoritesOnly = ref(false)
const selectedServerKey = ref<string | null>(null)

const siteTitle = computed(() => app.config?.siteTitle ?? 'CF Server Monitor')
const viewMode = computed({
  get: () => theme.viewMode,
  set: (value: DashboardViewMode) => theme.setDashboardViewMode(value),
})
const offlineLast = computed({
  get: () => theme.runtime.offlineNodesLast,
  set: (value: boolean) => theme.setLocalSetting('offlineNodesLast', value),
})
const visibleAdminUrl = computed(() => (
  theme.runtime.hideAdminEntryWhenLoggedOut && app.config?.authorization !== true
    ? null
    : app.administrationUrl
))
const metadataFields = computed(() => parseSettingKeys(theme.runtime.nodeListMetadataFields))
const glassServers = computed(() => (
  serverStore.servers.map((server) => toGlassServer(server, app.config))
))
const summary = computed(() => summarizeServers(glassServers.value))
const groups = computed(() => availableGroups(glassServers.value))
const visibleServers = computed(() => sortServers(
  filterServers(
    glassServers.value,
    query.value,
    selectedGroup.value,
    favoritesOnly.value ? preferences.favorites : undefined,
  ),
  sort.value,
  theme.runtime.offlineNodesLast,
))
const groupedServers = computed(() => groupServers(visibleServers.value))
const favoriteCount = computed(() => glassServers.value.reduce(
  (count, server) => count + (preferences.isFavorite(server.key) ? 1 : 0),
  0,
))
const selectedServer = computed(() => (
  glassServers.value.find((server) => server.key === selectedServerKey.value) ?? null
))
const isDenseCollection = computed(() => visibleServers.value.length >= 30)
const showSource = computed(() => (
  app.apiBases.length > 1 || serverStore.collections.length > 1
))
const sourceCount = computed(() => (
  app.apiBases.length || serverStore.collections.length
))
const initialLoading = computed(() => (
  glassServers.value.length === 0
  && (app.state === 'idle' || app.state === 'loading'
    || serverStore.state === 'idle' || serverStore.state === 'loading')
))
const hasNoServers = computed(() => (
  !initialLoading.value
  && serverStore.state !== 'error'
  && glassServers.value.length === 0
))
const hasNoMatches = computed(() => (
  glassServers.value.length > 0 && visibleServers.value.length === 0
))
const allOffline = computed(() => summary.value.total > 0 && summary.value.online === 0)
const realtimeLabel = computed(() => {
  if (realtime.status === 'live') return 'Live updates'
  if (realtime.status === 'fallback') return 'REST fallback'
  if (realtime.status === 'timed-out') return 'Live updates timed out'
  if (realtime.status === 'paused') return 'Live updates paused'
  if (realtime.status === 'connecting') return 'Live updates connecting'
  return 'REST snapshot'
})

watch(groups, (nextGroups) => {
  if (selectedGroup.value !== ALL_GROUPS && !nextGroups.includes(selectedGroup.value)) {
    selectedGroup.value = ALL_GROUPS
  }
})

watch(siteTitle, (title) => {
  document.title = title
}, { immediate: true })

async function refreshRest(): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([
      app.initialize(),
      serverStore.load(),
    ])
  } finally {
    refreshing.value = false
  }
}

async function refresh(): Promise<void> {
  await refreshRest()
  realtime.sync()
}

function openServer(server: GlassServer): void {
  selectedServerKey.value = server.key
}

function closeServer(): void {
  selectedServerKey.value = null
}

function viewServerDetails(server: GlassServer): void {
  closeServer()
  void router.push({
    name: 'server-detail',
    params: { id: server.id },
    query: { source: server.sourceBase },
  })
}

function cardStyle(index: number): Record<string, string> {
  return { '--node-item-delay': `${Math.min(index, 12) * 34}ms` }
}

onMounted(async () => {
  preferences.initialize()
  await refreshRest()
  realtime.start(refreshRest)
})

onUnmounted(() => realtime.stop())
</script>

<template>
  <div class="app-root">
    <DynamicBackground />
    <div class="app-shell">
      <AppHeader
        :title="siteTitle"
        :version="app.config?.version ?? null"
        :loading="refreshing"
        :online="summary.online"
        :total="summary.total"
        :source-count="sourceCount"
        :admin-url="visibleAdminUrl"
        :theme-mode="theme.runtime.themeMode"
        @refresh="refresh"
        @cycle-theme="theme.cycleTheme"
      />

      <main class="dashboard">
        <div
          v-if="app.state === 'error'"
          class="notice notice--warning"
          role="status"
        >
          <strong>站点配置读取失败</strong>
          <span>{{ app.error }}。节点数据仍会独立尝试加载。</span>
        </div>

        <div
          v-if="serverStore.sourceFailures.length > 0"
          class="notice notice--warning"
          role="status"
        >
          <strong>部分数据源暂不可用</strong>
          <span
            v-for="failure in serverStore.sourceFailures"
            :key="failure.source.base"
          >
            {{ failure.source.label }}：{{ failure.message }}
            <template v-if="failure.status">（HTTP {{ failure.status }}）</template>
          </span>
        </div>

        <section
          v-if="theme.runtime.alertEnabled && (theme.runtime.alertTitle || theme.runtime.alertContent)"
          class="theme-announcement glass-panel"
          role="status"
        >
          <span class="theme-announcement__mark" aria-hidden="true">i</span>
          <div>
            <strong>{{ theme.runtime.alertTitle || '站点公告' }}</strong>
            <p v-if="theme.runtime.alertContent">
              {{ theme.runtime.alertContent }}
            </p>
          </div>
        </section>

        <div
          v-if="realtime.timedOut"
          class="notice notice--warning notice--choice"
          role="status"
        >
          <div>
            <strong>实时连接已达到站点设置的连接时限</strong>
            <span>请选择继续建立新的实时连接，或暂时停用实时更新。</span>
          </div>
          <div class="notice__actions">
            <button type="button" @click="realtime.continueAfterTimeout">
              继续实时连接
            </button>
            <button type="button" @click="realtime.pauseAfterTimeout">
              保持暂停
            </button>
          </div>
        </div>

        <div
          v-else-if="realtime.paused"
          class="notice notice--warning notice--choice"
          role="status"
        >
          <div>
            <strong>实时更新已暂停</strong>
            <span>当前页面保留最后一次真实数据快照；恢复后会重新连接各数据源。</span>
          </div>
          <div class="notice__actions">
            <button type="button" @click="realtime.resume">
              恢复实时连接
            </button>
          </div>
        </div>

        <div
          v-if="realtime.fallbackActive"
          class="notice notice--warning"
          role="status"
        >
          <strong>实时连接暂不可用</strong>
          <span>已启用低频 REST 补偿刷新，WebSocket 会按退避策略继续恢复。</span>
        </div>

        <div
          v-if="allOffline"
          class="notice notice--offline"
          role="status"
        >
          <strong>当前所有节点均为离线状态</strong>
          <span>页面保留后端返回的最后指标，不把旧指标标记为实时数据。</span>
        </div>

        <template v-if="initialLoading">
          <section class="overview-stage overview-stage--loading" aria-label="正在加载总览">
            <div class="overview-stage__heading">
              <span class="skeleton skeleton--line" />
            </div>
            <div class="overview-grid">
              <span
                v-for="index in 6"
                :key="index"
                class="skeleton skeleton--overview"
              />
            </div>
          </section>
          <section class="skeleton-grid" aria-label="正在加载节点">
            <span
              v-for="index in 3"
              :key="index"
              class="skeleton skeleton--card"
            />
          </section>
        </template>

        <template v-else>
          <OverviewCards v-if="!theme.runtime.hideGeneralCard" :summary="summary" />

          <div
            v-if="serverStore.state === 'error'"
            class="state-panel state-panel--error"
            role="alert"
          >
            <span class="state-panel__icon" aria-hidden="true">!</span>
            <h2>无法加载节点</h2>
            <p>{{ serverStore.error }}</p>
            <button type="button" @click="refresh">
              重新加载
            </button>
          </div>

          <div
            v-else-if="hasNoServers"
            class="state-panel"
          >
            <span class="state-panel__icon" aria-hidden="true">0</span>
            <h2>暂无节点</h2>
            <p>CFSM 返回了空服务器列表。添加节点后，它们会出现在这里。</p>
          </div>

          <template v-else>
            <DashboardControls
              v-model:query="query"
              v-model:group="selectedGroup"
              v-model:sort="sort"
              v-model:view-mode="viewMode"
              v-model:favorites-only="favoritesOnly"
              v-model:offline-last="offlineLast"
              :groups="groups"
              :result-count="visibleServers.length"
              :favorite-count="favoriteCount"
              :quick-controls-enabled="theme.runtime.homeQuickControlsEnabled"
            />

            <div
              v-if="hasNoMatches"
              class="state-panel state-panel--compact"
            >
              <span class="state-panel__icon" aria-hidden="true">⌕</span>
              <h2>没有匹配节点</h2>
              <p>请调整搜索词或分组筛选。</p>
              <button
                type="button"
                @click="query = ''; selectedGroup = ALL_GROUPS"
              >
                清除筛选
              </button>
            </div>

            <div
              v-else
              class="server-groups"
            >
              <section
                v-for="group in groupedServers"
                :key="group.name"
                class="server-group"
              >
                <header class="server-group__header">
                  <div>
                    <span class="server-group__mark" aria-hidden="true" />
                    <h2>{{ group.name }}</h2>
                  </div>
                  <span>{{ group.servers.length }} 台</span>
                </header>

                <div
                  v-if="viewMode !== 'list'"
                  :class="[
                    'server-grid',
                    `server-grid--${viewMode}`,
                    `server-grid--size-${theme.runtime.nodeCardSize}`,
                    { 'server-grid--dense': isDenseCollection },
                  ]"
                >
                  <ServerCard
                    v-for="(server, index) in group.servers"
                    :key="server.key"
                    :server="server"
                    :show-source="showSource"
                    :density="viewMode"
                    :favorite="preferences.isFavorite(server.key)"
                    :high-load-threshold="theme.runtime.homeHighLoadThreshold"
                    :style="cardStyle(index)"
                    @open="openServer(server)"
                    @toggle-favorite="preferences.toggleFavorite(server.key)"
                  />
                </div>
                <ServerList
                  v-else
                  :servers="group.servers"
                  :show-source="showSource"
                  :favorite-keys="preferences.favorites"
                  :metadata-enabled="theme.runtime.nodeListMetadataEnabled"
                  :metadata-fields="metadataFields"
                  :custom-tags-visible="theme.runtime.nodeListCustomTagsVisible"
                  @open="openServer"
                  @toggle-favorite="preferences.toggleFavorite"
                />
              </section>
            </div>
          </template>
        </template>
      </main>

      <footer class="app-footer">
        <span>
          Powered by
          <a href="https://github.com/huilang-me/CF-Server-Monitor/">
            CF-Server-Monitor<template v-if="app.config?.version"> v{{ app.config.version }}</template>
          </a>
        </span>
        <span>Glassmorphism Theme · {{ realtimeLabel }}</span>
      </footer>
    </div>

    <ServerQuickView
      :open="selectedServer !== null"
      :server="selectedServer"
      :favorite="selectedServer ? preferences.isFavorite(selectedServer.key) : false"
      :show-source="showSource"
      @close="closeServer"
      @toggle-favorite="selectedServer && preferences.toggleFavorite(selectedServer.key)"
      @view-details="selectedServer && viewServerDetails(selectedServer)"
    />
  </div>
</template>
