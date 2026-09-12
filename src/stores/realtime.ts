import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createDashboardRealtime,
  type DashboardRealtimeController,
} from '@/services/cfsm'
import type { CfsmSocketState } from '@/types/cfsm'
import { useAppStore } from './app'
import { useServersStore } from './servers'
import { useThemeSettingsStore } from './theme-settings'

export type DashboardRealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'fallback'
  | 'timed-out'
  | 'paused'

export const useRealtimeStore = defineStore('realtime', () => {
  const app = useAppStore()
  const servers = useServersStore()
  const theme = useThemeSettingsStore()
  const sourceStates = ref<Record<string, CfsmSocketState>>({})
  const fallbackActive = ref(false)
  const timedOut = ref(false)
  const paused = ref(false)
  let controller: DashboardRealtimeController | null = null
  let staleTimer: ReturnType<typeof setInterval> | null = null

  const sourceCount = computed(() => Object.keys(sourceStates.value).length)
  const openSourceCount = computed(() => Object.values(sourceStates.value).filter(
    (state) => state === 'open',
  ).length)
  const status = computed<DashboardRealtimeStatus>(() => {
    if (timedOut.value) return 'timed-out'
    if (paused.value) return 'paused'
    if (fallbackActive.value) return 'fallback'
    if (openSourceCount.value > 0) return 'live'
    if (Object.values(sourceStates.value).some(
      (state) => state === 'connecting' || state === 'backoff',
    )) return 'connecting'
    return 'idle'
  })

  function stop(): void {
    controller?.dispose()
    controller = null
    if (staleTimer !== null) globalThis.clearInterval(staleTimer)
    staleTimer = null
    sourceStates.value = {}
    fallbackActive.value = false
    timedOut.value = false
    paused.value = false
  }

  function start(refreshRest: () => Promise<void>): void {
    stop()
    controller = createDashboardRealtime({
      getSources: () => servers.collections.map((collection) => ({
        base: collection.source.base,
        ids: collection.servers.map((server) => server.id),
      })),
      getTimeoutMinutes: () => app.config?.frontendWebsocketTimeoutMinutes ?? 0,
      /*
       * 主题设置「数据更新间隔」以秒为单位，只作用于 WebSocket 不可用时的 REST 回退
       * 轮询；服务端的推送批次由 CFSM 自己决定，主题改不了。取值函数保证设置改动
       * 下一次回退启动时即生效，不必重建 WebSocket 连接。
       */
      fallbackIntervalMs: () => theme.runtime.dataUpdateInterval * 1000,
      refreshRest,
      onSamples: (base, samples) => servers.applyRealtimeSamples(base, samples),
      onSourceState: (base, state) => {
        sourceStates.value = { ...sourceStates.value, [base]: state }
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
    controller.start()
    staleTimer = globalThis.setInterval(() => servers.expireStaleServers(), 30_000)
  }

  function sync(): void {
    controller?.sync()
  }

  function continueAfterTimeout(): void {
    controller?.continueAfterTimeout()
  }

  function pauseAfterTimeout(): void {
    controller?.pauseAfterTimeout()
  }

  function resume(): void {
    controller?.resume()
  }

  return {
    sourceStates,
    sourceCount,
    openSourceCount,
    fallbackActive,
    timedOut,
    paused,
    status,
    start,
    sync,
    continueAfterTimeout,
    pauseAfterTimeout,
    resume,
    stop,
  }
})
