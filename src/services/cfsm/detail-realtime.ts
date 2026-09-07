import type { CfsmRealtimeSample, CfsmSocketState } from '@/types/cfsm'
import {
  createCfsmSocket,
  type CfsmSocketConnection,
  type CfsmSocketOptions,
} from './websocket'
import type { VisibilitySource } from './dashboard-realtime'

const DEFAULT_FALLBACK_INTERVAL_MS = 60_000

type IntervalHandle = ReturnType<typeof setInterval>

export interface DetailRealtimeScheduler {
  setInterval(callback: () => void, delay: number): IntervalHandle
  clearInterval(handle: IntervalHandle): void
}

export type DetailSocketFactory = (options: CfsmSocketOptions) => CfsmSocketConnection

export interface DetailRealtimeOptions {
  base: string
  serverId: string
  timeoutMinutes: number
  refreshRest(): Promise<void>
  onSamples(samples: CfsmRealtimeSample[]): void
  onState(state: CfsmSocketState): void
  onFallbackChange(active: boolean): void
  onTimeoutChange(timedOut: boolean): void
  onPausedChange(paused: boolean): void
  createSocket?: DetailSocketFactory
  documentRef?: VisibilitySource
  scheduler?: DetailRealtimeScheduler
  fallbackIntervalMs?: number
}

export interface DetailRealtimeController {
  start(): void
  continueAfterTimeout(): void
  pauseAfterTimeout(): void
  resume(): void
  dispose(): void
}

const defaultScheduler: DetailRealtimeScheduler = {
  setInterval: (callback, delay) => globalThis.setInterval(callback, delay),
  clearInterval: (handle) => globalThis.clearInterval(handle),
}

function defaultDocument(): VisibilitySource | undefined {
  return typeof document === 'undefined' ? undefined : document
}

export function createDetailRealtime(options: DetailRealtimeOptions): DetailRealtimeController {
  const createSocket = options.createSocket ?? createCfsmSocket
  const documentRef = options.documentRef ?? defaultDocument()
  const scheduler = options.scheduler ?? defaultScheduler
  const fallbackIntervalMs = Math.max(
    options.fallbackIntervalMs ?? DEFAULT_FALLBACK_INTERVAL_MS,
    30_000,
  )
  let connection: CfsmSocketConnection | null = null
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

  function startFallback(): void {
    if (fallbackTimer !== null || disposed || timedOut || paused || !visible()) return
    fallbackActive = true
    options.onFallbackChange(true)
    fallbackTimer = scheduler.setInterval(() => {
      void refreshRest()
    }, fallbackIntervalMs)
  }

  async function refreshRest(): Promise<void> {
    if (refreshInFlight || disposed || !visible()) return
    refreshInFlight = true
    try {
      await options.refreshRest()
    } catch {
      // The detail store owns the visible error while retaining its last real snapshot.
    } finally {
      refreshInFlight = false
    }
  }

  function closeConnection(): void {
    const current = connection
    connection = null
    current?.close()
  }

  function connect(): void {
    if (!started || disposed || connection || !visible() || timedOut || paused) return
    connection = createSocket({
      base: options.base,
      ids: [options.serverId],
      subscribe: options.serverId,
      timeoutMinutes: options.timeoutMinutes,
      onSamples: options.onSamples,
      onState: (state) => {
        options.onState(state)
        if (state === 'open') stopFallback()
        else if (state === 'backoff' || state === 'unavailable') startFallback()
      },
      onTimeout: () => {
        if (disposed || timedOut) return
        timedOut = true
        paused = false
        connection = null
        stopFallback()
        options.onPausedChange(false)
        options.onTimeoutChange(true)
      },
    })
  }

  async function refreshAndReconnect(revision: number): Promise<void> {
    await refreshRest()
    if (revision === visibilityRevision) connect()
  }

  function handleVisibilityChange(): void {
    visibilityRevision += 1
    if (!visible()) {
      closeConnection()
      stopFallback()
      return
    }
    if (timedOut || paused) return
    void refreshAndReconnect(visibilityRevision)
  }

  return {
    start() {
      if (started || disposed) return
      started = true
      documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
      connect()
    },
    continueAfterTimeout() {
      if (disposed) return
      timedOut = false
      paused = false
      options.onTimeoutChange(false)
      options.onPausedChange(false)
      connect()
    },
    pauseAfterTimeout() {
      if (disposed) return
      timedOut = false
      paused = true
      options.onTimeoutChange(false)
      options.onPausedChange(true)
      closeConnection()
      stopFallback()
    },
    resume() {
      if (disposed) return
      timedOut = false
      paused = false
      options.onTimeoutChange(false)
      options.onPausedChange(false)
      connect()
    },
    dispose() {
      if (disposed) return
      disposed = true
      visibilityRevision += 1
      documentRef?.removeEventListener('visibilitychange', handleVisibilityChange)
      closeConnection()
      stopFallback()
    },
  }
}
