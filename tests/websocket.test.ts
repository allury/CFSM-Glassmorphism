import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCfsmSocket,
  createCfsmSocketUrl,
  sanitizeSubscriptionIds,
  type CfsmSocketLike,
} from '@/services/cfsm/websocket'

class FakeSocket implements CfsmSocketLike {
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: ((event: { code: number; reason?: string }) => void) | null = null
  readonly sent: string[] = []
  readonly closes: Array<{ code?: number; reason?: string }> = []

  send(payload: string): void {
    this.sent.push(payload)
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3
    this.closes.push({ code, reason })
  }

  open(): void {
    this.readyState = 1
    this.onopen?.()
  }

  message(value: unknown): void {
    this.onmessage?.({ data: JSON.stringify(value) })
  }

  remoteClose(code: number): void {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

function memoryStorage(values: Record<string, string>): Storage {
  const data = new Map(Object.entries(values))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

afterEach(() => vi.useRealTimers())

describe('CFSM WebSocket transport', () => {
  it('builds source-aware URLs and exposes JWT only to a cross-host socket', () => {
    const storage = memoryStorage({ jwt_token: 'secret-token' })

    expect(createCfsmSocketUrl('https://a.example', {
      storage,
      locationHost: 'a.example',
    })).toBe('wss://a.example/api/ws?subscribe=all')
    expect(createCfsmSocketUrl('https://b.example', {
      storage,
      locationHost: 'a.example',
    })).toBe('wss://b.example/api/ws?subscribe=all&token=secret-token')
  })

  it('sanitizes IDs and sends the exact all-scope subscription and heartbeat', () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const samples = vi.fn()
    createCfsmSocket({
      base: 'https://a.example',
      ids: ['node-a', 'node-a', 'invalid id', 'node:b'],
      timeoutMinutes: 0,
      locationHost: 'a.example',
      socketFactory: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      onSamples: samples,
      onState: vi.fn(),
      onTimeout: vi.fn(),
    })

    expect(sanitizeSubscriptionIds([' ok ', 'bad id', 'ok'])).toEqual(['ok'])
    sockets[0]?.open()
    expect(sockets[0]?.sent[0]).toBe(JSON.stringify({
      type: 'subscribe',
      scope: 'all',
      ids: ['node-a', 'node:b'],
    }))
    vi.advanceTimersByTime(30_000)
    expect(sockets[0]?.sent[1]).toBe(JSON.stringify({ type: 'ping' }))

    sockets[0]?.message({
      type: 'batchUpdate',
      updates: [{ serverId: 'node-a', samples: [{ payload: { cpu: 12 } }] }],
    })
    expect(samples).toHaveBeenCalledWith([{
      serverId: 'node-a',
      timestamp: null,
      data: { cpu: 12 },
    }])
  })

  it('uses bounded exponential reconnect backoff without parallel retry storms', () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const states: string[] = []
    const connection = createCfsmSocket({
      base: 'https://a.example',
      ids: ['node-a'],
      timeoutMinutes: 0,
      socketFactory: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      onSamples: vi.fn(),
      onState: (state) => states.push(state),
      onTimeout: vi.fn(),
    })

    sockets[0]?.remoteClose(1006)
    sockets[0]?.remoteClose(1006)
    vi.advanceTimersByTime(999)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)

    sockets[1]?.remoteClose(1006)
    vi.advanceTimersByTime(1_999)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)
    expect(states.filter((state) => state === 'backoff')).toHaveLength(2)
    connection.close()
  })

  it('stops silently reconnecting when the configured lifetime expires', () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const timedOut = vi.fn()
    const connection = createCfsmSocket({
      base: 'https://a.example',
      ids: ['node-a'],
      timeoutMinutes: 1,
      socketFactory: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      onSamples: vi.fn(),
      onState: vi.fn(),
      onTimeout: timedOut,
    })

    sockets[0]?.open()
    vi.advanceTimersByTime(60_000)
    expect(timedOut).toHaveBeenCalledOnce()
    expect(sockets[0]?.closes).toContainEqual({
      code: 1000,
      reason: 'connection lifetime exceeded',
    })
    vi.advanceTimersByTime(120_000)
    expect(sockets).toHaveLength(1)
    connection.close()
  })

  it('treats a policy close as unavailable without retrying', () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const states: string[] = []
    createCfsmSocket({
      base: 'https://a.example',
      ids: ['node-a'],
      timeoutMinutes: 0,
      socketFactory: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      onSamples: vi.fn(),
      onState: (state) => states.push(state),
      onTimeout: vi.fn(),
    })

    sockets[0]?.remoteClose(1008)
    vi.advanceTimersByTime(120_000)
    expect(sockets).toHaveLength(1)
    expect(states.at(-1)).toBe('unavailable')
  })
})
