<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
import { useServersStore } from '@/stores/servers'
import type { DashboardSort, GlassServer } from '@/types/glassmorphism'

const app = useAppStore()
const serverStore = useServersStore()
const preferences = useDashboardPreferencesStore()

const query = ref('')
const selectedGroup = ref(ALL_GROUPS)
const sort = ref<DashboardSort>('order')
const refreshing = ref(false)
const favoritesOnly = ref(false)
const selectedServerKey = ref<string | null>(null)

const siteTitle = computed(() => app.config?.siteTitle ?? 'CF Server Monitor')
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
  preferences.offlineLast,
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

watch(groups, (nextGroups) => {
  if (selectedGroup.value !== ALL_GROUPS && !nextGroups.includes(selectedGroup.value)) {
    selectedGroup.value = ALL_GROUPS
  }
})

watch(siteTitle, (title) => {
  document.title = title
}, { immediate: true })

async function refresh(): Promise<void> {
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

function openServer(server: GlassServer): void {
  selectedServerKey.value = server.key
}

function closeServer(): void {
  selectedServerKey.value = null
}

function cardStyle(index: number): Record<string, string> {
  return { '--node-item-delay': `${Math.min(index, 12) * 34}ms` }
}

onMounted(async () => {
  preferences.initialize()
  await refresh()
  preferences.adoptPreferredTheme(app.config?.preferredTheme ?? 'auto')
})
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
        :admin-url="app.administrationUrl"
        :theme-mode="preferences.themeMode"
        @refresh="refresh"
        @cycle-theme="preferences.cycleTheme"
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
          <OverviewCards :summary="summary" />

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
              v-model:view-mode="preferences.viewMode"
              v-model:favorites-only="favoritesOnly"
              v-model:offline-last="preferences.offlineLast"
              :groups="groups"
              :result-count="visibleServers.length"
              :favorite-count="favoriteCount"
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
                  v-if="preferences.viewMode !== 'list'"
                  :class="[
                    'server-grid',
                    `server-grid--${preferences.viewMode}`,
                    { 'server-grid--dense': isDenseCollection },
                  ]"
                >
                  <ServerCard
                    v-for="(server, index) in group.servers"
                    :key="server.key"
                    :server="server"
                    :show-source="showSource"
                    :density="preferences.viewMode"
                    :favorite="preferences.isFavorite(server.key)"
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
        <span>Glassmorphism Theme · REST snapshot</span>
      </footer>
    </div>

    <ServerQuickView
      :open="selectedServer !== null"
      :server="selectedServer"
      :favorite="selectedServer ? preferences.isFavorite(selectedServer.key) : false"
      :show-source="showSource"
      @close="closeServer"
      @toggle-favorite="selectedServer && preferences.toggleFavorite(selectedServer.key)"
    />
  </div>
</template>
