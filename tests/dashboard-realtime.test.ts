import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDashboardRealtime,
  type DashboardRealtimeSource,
  type VisibilitySource,
} from '@/services/cfsm/dashboard-realtime'
import type {
  CfsmSocketConnection,
  CfsmSocketOptions,
} from '@/services/cfsm/websocket'

class FakeVisibility implements VisibilitySource {
  hidden = false
  private readonly listeners = new Set<() => void>()

  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener)
  }

  emit(): void {
    for (const listener of this.listeners) listener()
  }
}

function connectionFactory() {
  const options: CfsmSocketOptions[] = []
  const connections: Array<CfsmSocketConnection & {
    close: ReturnType<typeof vi.fn>
    updateIds: ReturnType<typeof vi.fn>
  }> = []
  const createSocket = (socketOptions: CfsmSocketOptions): CfsmSocketConnection => {
    options.push(socketOptions)
    const connection = {
      close: vi.fn(),
      updateIds: vi.fn(),
    }
    connections.push(connection)
    return connection
  }
  return { options, connections, createSocket }
}

afterEach(() => vi.useRealTimers())

describe('dashboard realtime coordination', () => {
  it('creates exactly one connection per API base with only source-owned IDs', () => {
    let sources: DashboardRealtimeSource[] = [
      { base: 'https://a.example', ids: ['a-1', 'same-id'] },
      { base: 'https://b.example', ids: ['b-1', 'same-id'] },
    ]
    const factory = connectionFactory()
    const controller = createDashboardRealtime({
      getSources: () => sources,
      getTimeoutMinutes: () => 20,
      refreshRest: async () => undefined,
      onSamples: vi.fn(),
      onSourceState: vi.fn(),
      onFallbackChange: vi.fn(),
      onTimeoutChange: vi.fn(),
      onPausedChange: vi.fn(),
      createSocket: factory.createSocket,
    })

    controller.start()
    expect(factory.options.map(({ base, ids }) => ({ base, ids }))).toEqual([
      { base: 'https://a.example', ids: ['a-1', 'same-id'] },
      { base: 'https://b.example', ids: ['b-1', 'same-id'] },
    ])
    expect(factory.options.every((option) => option.timeoutMinutes === 20)).toBe(true)

    sources = [{ base: 'https://a.example', ids: ['a-2'] }]
    controller.sync()
    expect(factory.connections[0]?.updateIds).toHaveBeenCalledWith(['a-2'])
    expect(factory.connections[1]?.close).toHaveBeenCalledOnce()
    controller.dispose()
  })

  it('closes while hidden and waits for REST refresh before reconnecting', async () => {
    const visibility = new FakeVisibility()
    const factory = connectionFactory()
    let finishRefresh: (() => void) | undefined
    const refreshRest = vi.fn(() => new Promise<void>((resolve) => {
      finishRefresh = resolve
    }))
    const controller = createDashboardRealtime({
      getSources: () => [{ base: 'https://a.example', ids: ['a-1'] }],
      getTimeoutMinutes: () => 0,
      refreshRest,
      onSamples: vi.fn(),
      onSourceState: vi.fn(),
      onFallbackChange: vi.fn(),
      onTimeoutChange: vi.fn(),
      onPausedChange: vi.fn(),
      createSocket: factory.createSocket,
      documentRef: visibility,
    })

    controller.start()
    visibility.hidden = true
    visibility.emit()
    expect(factory.connections[0]?.close).toHaveBeenCalledOnce()

    visibility.hidden = false
    visibility.emit()
    expect(refreshRest).toHaveBeenCalledOnce()
    expect(factory.connections).toHaveLength(1)
    finishRefresh?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(factory.connections).toHaveLength(2)
    controller.dispose()
  })

  it('requires an explicit decision after the configured connection lifetime', () => {
    const factory = connectionFactory()
    const onTimeoutChange = vi.fn()
    const onPausedChange = vi.fn()
    const controller = createDashboardRealtime({
      getSources: () => [{ base: 'https://a.example', ids: ['a-1'] }],
      getTimeoutMinutes: () => 5,
      refreshRest: async () => undefined,
      onSamples: vi.fn(),
      onSourceState: vi.fn(),
      onFallbackChange: vi.fn(),
      onTimeoutChange,
      onPausedChange,
      createSocket: factory.createSocket,
    })

    controller.start()
    factory.options[0]?.onTimeout()
    expect(factory.connections[0]?.close).toHaveBeenCalledOnce()
    expect(onTimeoutChange).toHaveBeenLastCalledWith(true)

    controller.continueAfterTimeout()
    expect(factory.connections).toHaveLength(2)
    expect(onTimeoutChange).toHaveBeenLastCalledWith(false)

    factory.options[1]?.onTimeout()
    controller.pauseAfterTimeout()
    expect(onPausedChange).toHaveBeenLastCalledWith(true)
    expect(factory.connections).toHaveLength(2)
    controller.dispose()
  })

  it('keeps one low-frequency REST fallback after a 503 while WebSocket recovery backs off', async () => {
    vi.useFakeTimers()
    const factory = connectionFactory()
    const unavailable = Object.assign(new Error('temporarilyUnavailable'), { status: 503 })
    const refreshRest = vi.fn(async () => {
      throw unavailable
    })
    const onFallbackChange = vi.fn()
    const controller = createDashboardRealtime({
      getSources: () => [{ base: 'https://a.example', ids: ['a-1'] }],
      getTimeoutMinutes: () => 0,
      refreshRest,
      onSamples: vi.fn(),
      onSourceState: vi.fn(),
      onFallbackChange,
      onTimeoutChange: vi.fn(),
      onPausedChange: vi.fn(),
      createSocket: factory.createSocket,
      fallbackIntervalMs: 30_000,
    })

    controller.start()
    factory.options[0]?.onState('unavailable')
    factory.options[0]?.onState('backoff')
    expect(onFallbackChange.mock.calls).toEqual([[true]])

    await vi.advanceTimersByTimeAsync(29_999)
    expect(refreshRest).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(refreshRest).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(refreshRest).toHaveBeenCalledTimes(2)
    controller.dispose()
    expect(onFallbackChange).toHaveBeenLastCalledWith(false)
  })
})
