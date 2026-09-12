import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type {
  CfsmRequestIssue,
  CfsmServer,
  CfsmSocketState,
  HistorySeries,
  SiteConfig,
} from '@/types/cfsm'
import {
  classifyCfsmRequestError,
  createDetailRealtime,
  fetchHistory,
  fetchServer,
  fetchServerFromSources,
  fetchSiteConfig,
  mergeRealtimeSample,
  type DetailRealtimeController,
  type HistoryHours,
} from '@/services/cfsm'
import { useThemeSettingsStore } from './theme-settings'

export type DetailLoadState = 'idle' | 'loading' | 'ready' | 'error'
export type HistoryLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export const useServerDetailStore = defineStore('server-detail', () => {
  const theme = useThemeSettingsStore()
  const server = shallowRef<CfsmServer | null>(null)
  const sourceConfig = shallowRef<SiteConfig | null>(null)
  const history = shallowRef<HistorySeries | null>(null)
  const historyHours = ref<HistoryHours>(24)
  /*
   * 上游负载图与延迟图各有一条时间范围选择（LoadChart 默认「实时」、
   * PingChart 默认「1 小时」），两者互不影响。CFSM 只有一个 `/api/history/all`，
   * 这里为延迟区单独保存一份历史，默认取上游同样的 1 小时。
   */
  const pingHistory = shallowRef<HistorySeries | null>(null)
  const pingHistoryHours = ref<HistoryHours>(1)
  const state = ref<DetailLoadState>('idle')
  const historyState = ref<HistoryLoadState>('idle')
  const pingHistoryState = ref<HistoryLoadState>('idle')
  const issue = ref<CfsmRequestIssue | null>(null)
  const historyIssue = ref<CfsmRequestIssue | null>(null)
  const pingHistoryIssue = ref<CfsmRequestIssue | null>(null)
  const refreshIssue = ref<CfsmRequestIssue | null>(null)
  const socketState = ref<CfsmSocketState>('idle')
  const fallbackActive = ref(false)
  const timedOut = ref(false)
  const paused = ref(false)
  const lastRealtimeAt = ref<number | null>(null)
  let realtime: DetailRealtimeController | null = null
  let requestController: AbortController | null = null
  let revision = 0

  const sourceBase = computed(() => server.value?.source.base ?? null)
  const historyPoints = computed(() => history.value?.points ?? [])
  const pingHistoryPoints = computed(() => pingHistory.value?.points ?? [])

  function stopRealtime(): void {
    realtime?.dispose()
    realtime = null
    socketState.value = 'idle'
    fallbackActive.value = false
    timedOut.value = false
    paused.value = false
  }

  function applySamples(samples: Parameters<typeof mergeRealtimeSample>[1][]): void {
    let current = server.value
    if (!current) return
    const receivedAt = Date.now()
    for (const sample of samples) {
      if (sample.serverId !== current.id) continue
      current = mergeRealtimeSample(current, sample, receivedAt)
    }
    server.value = current
    lastRealtimeAt.value = receivedAt
  }

  function startRealtime(): void {
    stopRealtime()
    const current = server.value
    if (!current) return
    realtime = createDetailRealtime({
      base: current.source.base,
      serverId: current.id,
      timeoutMinutes: sourceConfig.value?.frontendWebsocketTimeoutMinutes ?? 0,
      /* 与首页同一个设置项：只影响 WebSocket 不可用时的 REST 回退刷新间隔。 */
      fallbackIntervalMs: () => theme.runtime.dataUpdateInterval * 1000,
      refreshRest: refreshServer,
      onSamples: applySamples,
      onState: (nextState) => {
        socketState.value = nextState
      },
      onFallbackChange: (active) => {
        fallbackActive.value = active
      },
      onTimeoutChange: (active) => {
        timedOut.value = active
      },
      onPausedChange: (active) => {
        paused.value = active
      },
    })
    realtime.start()
  }

  async function refreshServer(): Promise<void> {
    const current = server.value
    const controller = requestController
    if (!current || !controller) return
    try {
      const refreshed = await fetchServer(current.id, current.source.base, {
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        server.value = refreshed
        refreshIssue.value = null
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const nextIssue = classifyCfsmRequestError(error)
      refreshIssue.value = nextIssue
      if (nextIssue.kind === 'not-found') {
        server.value = null
        issue.value = nextIssue
        state.value = 'error'
        stopRealtime()
      }
      throw error
    }
  }

  async function loadHistory(hours = historyHours.value): Promise<void> {
    const current = server.value
    const controller = requestController
    if (!current || !controller) return
    historyHours.value = hours
    historyState.value = 'loading'
    historyIssue.value = null
    const expectedRevision = revision
    try {
      const result = await fetchHistory(current.id, hours, current.source.base, {
        signal: controller.signal,
      })
      if (controller.signal.aborted || expectedRevision !== revision) return
      history.value = result
      historyState.value = result.points.length > 0 ? 'ready' : 'empty'
    } catch (error) {
      if (controller.signal.aborted || expectedRevision !== revision) return
      history.value = null
      historyState.value = 'error'
      historyIssue.value = classifyCfsmRequestError(error)
    }
  }

  async function loadPingHistory(hours = pingHistoryHours.value): Promise<void> {
    const current = server.value
    const controller = requestController
    if (!current || !controller) return
    pingHistoryHours.value = hours
    pingHistoryState.value = 'loading'
    pingHistoryIssue.value = null
    const expectedRevision = revision
    try {
      const result = await fetchHistory(current.id, hours, current.source.base, {
        signal: controller.signal,
      })
      if (controller.signal.aborted || expectedRevision !== revision || pingHistoryHours.value !== hours) return
      pingHistory.value = result
      pingHistoryState.value = result.points.length > 0 ? 'ready' : 'empty'
    } catch (error) {
      if (controller.signal.aborted || expectedRevision !== revision || pingHistoryHours.value !== hours) return
      pingHistory.value = null
      pingHistoryState.value = 'error'
      pingHistoryIssue.value = classifyCfsmRequestError(error)
    }
  }

  async function loadSourceConfig(expectedRevision: number): Promise<void> {
    const current = server.value
    const controller = requestController
    if (!current || !controller) return
    try {
      const config = await fetchSiteConfig(current.source.base, { signal: controller.signal })
      if (!controller.signal.aborted && expectedRevision === revision) sourceConfig.value = config
    } catch {
      if (!controller.signal.aborted && expectedRevision === revision) sourceConfig.value = null
    }
  }

  async function open(
    id: string,
    bases: readonly string[],
    preferredBase?: string,
  ): Promise<void> {
    revision += 1
    const expectedRevision = revision
    requestController?.abort('detail changed')
    stopRealtime()
    requestController = new AbortController()
    server.value = null
    sourceConfig.value = null
    history.value = null
    pingHistory.value = null
    issue.value = null
    historyIssue.value = null
    pingHistoryIssue.value = null
    refreshIssue.value = null
    historyState.value = 'idle'
    pingHistoryState.value = 'idle'
    lastRealtimeAt.value = null
    state.value = 'loading'

    try {
      const result = await fetchServerFromSources(id, bases, {
        signal: requestController.signal,
      }, preferredBase)
      if (requestController.signal.aborted || expectedRevision !== revision) return
      server.value = result
      state.value = 'ready'
      const configPromise = loadSourceConfig(expectedRevision)
      const historyPromise = loadHistory(historyHours.value)
      const pingHistoryPromise = loadPingHistory(pingHistoryHours.value)
      await configPromise
      if (requestController.signal.aborted || expectedRevision !== revision) return
      startRealtime()
      await Promise.all([historyPromise, pingHistoryPromise])
    } catch (error) {
      if (requestController.signal.aborted || expectedRevision !== revision) return
      issue.value = classifyCfsmRequestError(error)
      state.value = 'error'
    }
  }

  async function refresh(): Promise<void> {
    await Promise.allSettled([
      refreshServer(),
      loadHistory(historyHours.value),
      loadPingHistory(pingHistoryHours.value),
    ])
  }

  function continueAfterTimeout(): void {
    realtime?.continueAfterTimeout()
  }

  function pauseAfterTimeout(): void {
    realtime?.pauseAfterTimeout()
  }

  function resume(): void {
    realtime?.resume()
  }

  function close(): void {
    revision += 1
    requestController?.abort('detail closed')
    requestController = null
    stopRealtime()
  }

  return {
    server,
    sourceConfig,
    history,
    historyHours,
    historyPoints,
    pingHistory,
    pingHistoryHours,
    pingHistoryPoints,
    sourceBase,
    state,
    historyState,
    pingHistoryState,
    issue,
    historyIssue,
    pingHistoryIssue,
    refreshIssue,
    socketState,
    fallbackActive,
    timedOut,
    paused,
    lastRealtimeAt,
    open,
    refresh,
    loadHistory,
    loadPingHistory,
    continueAfterTimeout,
    pauseAfterTimeout,
    resume,
    close,
  }
})
