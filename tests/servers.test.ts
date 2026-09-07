import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { normalizeServer } from '@/services/cfsm/adapters'
import { apiSource } from '@/services/cfsm/config'
import { useServersStore } from '@/stores/servers'
import type { ServerCollection } from '@/types/cfsm'

function collection(base: string, cpu: number): ServerCollection {
  const source = apiSource(base)
  return {
    source,
    servers: [normalizeServer({
      id: 'same-id',
      name: source.label,
      cpu,
      ram_total: 8192,
      ram_used: 1024,
      disk_total: 100_000,
      disk_used: 50_000,
      is_online: true,
      last_updated: 1_700_000_000,
    }, source, 1_700_000_000_000)],
    stats: {},
  }
}

describe('realtime server store', () => {
  it('merges samples only into the owning API base and preserves missing fields', () => {
    setActivePinia(createPinia())
    const store = useServersStore()
    store.collections = [
      collection('https://a.example', 10),
      collection('https://b.example', 20),
    ]

    store.applyRealtimeSamples('https://a.example', [{
      serverId: 'same-id',
      timestamp: 1_700_000_010,
      data: { cpu: 33, ram_used: 2048, ping_node_1: null, loss_node_1: 0 },
    }], 1_700_000_010_000)

    expect(store.findServer('https://a.example', 'same-id')).toMatchObject({
      cpu: 33,
      memoryUsed: 2048,
      memoryTotal: 8192,
      diskTotal: 100_000,
      latency: { node_1: null },
      packetLoss: { node_1: 0 },
    })
    expect(store.findServer('https://b.example', 'same-id')).toMatchObject({
      cpu: 20,
      memoryUsed: 1024,
      latency: { node_1: false },
      packetLoss: { node_1: false },
    })
    expect(store.lastRealtimeAt).toBe(1_700_000_010_000)
  })

  it('marks online nodes stale after five minutes without inventing new metrics', () => {
    setActivePinia(createPinia())
    const store = useServersStore()
    store.collections = [collection('https://a.example', 10)]

    store.expireStaleServers(1_700_000_299_000)
    expect(store.servers[0]?.online).toBe(true)
    store.expireStaleServers(1_700_000_301_000)
    expect(store.servers[0]).toMatchObject({ online: false, cpu: 10 })
  })
})
