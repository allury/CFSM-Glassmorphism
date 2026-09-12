import type { CfsmRealtimeSample, CfsmSocketState } from '@/types/cfsm'
import {
  createCfsmSocket,
  type CfsmSocketConnection,
  type CfsmSocketOptions,
} from './websocket'

const DEFAULT_FALLBACK_INTERVAL_MS = 60_000
/*
 * 主题设置「数据更新间隔」驱动这个回退轮询。CFSM 的实时数据是 WebSocket 推送
 * （服务端 `subscribe=all` 约 5 秒合并一批），只有连接不可用时才会走这条 REST 回退，
 * 因此下限取与服务端批次相同的 5 秒：比它更密只会重复打同一份快照并消耗 D1 额度。
 */
const MIN_FALLBACK_INTERVAL_MS = 5_000

type IntervalHandle = ReturnType<typeof setInterval>

export interface DashboardRealtimeSource {
  base: string
  ids: readonly string[]
}

export interface VisibilitySource {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export interface DashboardRealtimeScheduler {
  setInterval(callback: () => void, delay: number): IntervalHandle
  clearInterval(handle: IntervalHandle): void
}

export type DashboardSocketFactory = (options: CfsmSocketOptions) => CfsmSocketConnection

export interface DashboardRealtimeOptions {
  getSources(): readonly DashboardRealtimeSource[]
  getTimeoutMinutes(): number
  refreshRest(): Promise<void>
  onSamples(base: string, samples: CfsmRealtimeSample[]): void
  onSourceState(base: string, state: CfsmSocketState): void
  onFallbackChange(active: boolean): void
  onTimeoutChange(timedOut: boolean): void
  onPausedChange(paused: boolean): void
  createSocket?: DashboardSocketFactory
  documentRef?: VisibilitySource
  scheduler?: DashboardRealtimeScheduler
  /** 固定值，或每次启动回退轮询时读取的取值函数（设置改了无需重建连接）。 */
  fallbackIntervalMs?: number | (() => number)
}

export interface DashboardRealtimeController {
  start(): void
  sync(): void
  continueAfterTimeout(): void
  pauseAfterTimeout(): void
  resume(): void
  dispose(): void
}

const defaultScheduler: DashboardRealtimeScheduler = {
  setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
  clearInterval: (handle) => globalThis.clearInterval(handle),
}

function defaultDocument(): VisibilitySource | undefined {
  return typeof document === 'undefined' ? undefined : document
}

export function createDashboardRealtime(
  options: DashboardRealtimeOptions,
): DashboardRealtimeController {
  const createSocket = options.createSocket ?? createCfsmSocket
  const documentRef = options.documentRef ?? defaultDocument()
  const scheduler = options.scheduler ?? defaultScheduler
  function fallbackIntervalMs(): number {
    const configured = typeof options.fallbackIntervalMs === 'function'
      ? options.fallbackIntervalMs()
      : options.fallbackIntervalMs
    const requested = typeof configured === 'number' && Number.isFinite(configured)
      ? configured
      : DEFAULT_FALLBACK_INTERVAL_MS
    return Math.max(requested, MIN_FALLBACK_INTERVAL_MS)
  }
  const connections = new Map<string, CfsmSocketConnection>()
  const states = new Map<string, CfsmSocketState>()
  let fallbackTimer: IntervalHandle | null = null
  let fallbackActive = false
  let refreshInFlight = false
  let started = false
  let disposed = false
  let timedOut = false
  let paused = false
  let visibilityRevision = 0

  function visible(): boolean {
    return documentRef?.hidden !== true
  }

  function stopFallback(): void {
    if (fallbackTimer !== null) scheduler.clearInterval(fallbackTimer)
    fallbackTimer = null
    if (!fallbackActive) return
    fallbackActive = false
    options.onFallbackChange(false)
  }

  async function refreshAndSync(revision = visibilityRevision): Promise<void> {
    if (refreshInFlight || disposed || !visible() || timedOut || paused) return
    refreshInFlight = true
    try {
      await options.refreshRest()
    } catch {
      // The REST stores own their visible error state; existing data remains available.
    } finally {
      refreshInFlight = false
      if (revision === visibilityRevision && !disposed && visible() && !timedOut && !paused) {
        sync()
      }
    }
  }

  function updateFallback(): void {
    const needsFallback = started
      && !disposed
      && visible()
      && !timedOut
      && !paused
      && [...states.values()].some((state) => state === 'backoff' || state === 'unavailable')

    if (!needsFallback) {
      stopFallback()
      return
    }
    if (fallbackTimer !== null) return
    fallbackActive = true
    options.onFallbackChange(true)
    fallbackTimer = scheduler.setInterval(() => {
      void refreshAndSync()
    }, fallbackIntervalMs())
  }

  function closeConnections(): void {
    const current = [...connections.values()]
    connections.clear()
    for (const connection of current) connection.close()
  }

  function handleTimeout(): void {
    if (timedOut || disposed) return
    timedOut = true
    paused = false
    options.onPausedChange(false)
    options.onTimeoutChange(true)
    closeConnections()
    stopFallback()
  }

  function sync(): void {
    if (!started || disposed || !visible() || timedOut || paused) return
    const sources = new Map(
      options.getSources()
        .filter((source) => source.ids.length > 0)
        .map((source) => [source.base, source]),
    )

    for (const [base, connection] of connections) {
      const source = sources.get(base)
      if (source) {
        connection.updateIds(source.ids)
        sources.delete(base)
      } else {
        connections.delete(base)
        states.delete(base)
        connection.close()
      }
    }

    for (const source of sources.values()) {
      const connection = createSocket({
        base: source.base,
        ids: source.ids,
        timeoutMinutes: options.getTimeoutMinutes(),
        onSamples: (samples) => options.onSamples(source.base, samples),
        onState: (state) => {
          states.set(source.base, state)
          options.onSourceState(source.base, state)
          updateFallback()
        },
        onTimeout: handleTimeout,
      })
      connections.set(source.base, connection)
    }
    updateFallback()
  }

  function handleVisibilityChange(): void {
    visibilityRevision += 1
    if (!visible()) {
      closeConnections()
      stopFallback()
      return
    }
    if (timedOut || paused) return
    void refreshAndSync(visibilityRevision)
  }

  return {
    start() {
      if (started || disposed) return
      started = true
      documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
      if (visible()) sync()
    },
    sync,
    continueAfterTimeout() {
      if (disposed) return
      timedOut = false
      paused = false
      options.onTimeoutChange(false)
      options.onPausedChange(false)
      sync()
    },
    pauseAfterTimeout() {
      if (disposed) return
      timedOut = false
      paused = true
      options.onTimeoutChange(false)
      options.onPausedChange(true)
      closeConnections()
      stopFallback()
    },
    resume() {
      if (disposed) return
      timedOut = false
      paused = false
      options.onTimeoutChange(false)
      options.onPausedChange(false)
      sync()
    },
    dispose() {
      if (disposed) return
      disposed = true
      visibilityRevision += 1
      documentRef?.removeEventListener('visibilitychange', handleVisibilityChange)
      closeConnections()
      stopFallback()
      states.clear()
    },
  }
}
