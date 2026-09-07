import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  CfsmRealtimeSample,
  CfsmServer,
  ServerCollection,
  ServerSourceFailure,
} from '@/types/cfsm'
import { fetchAllServerSources, getApiBases, mergeRealtimeSample } from '@/services/cfsm'
import type { LoadState } from './app'

const FIVE_MINUTES_MS = 5 * 60 * 1000

function serverKey(base: string, id: string): string {
  return base + '::' + id
}

function timestampMilliseconds(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null
  return value < 1_000_000_000_000 ? value * 1000 : value
}

export const useServersStore = defineStore('servers', () => {
  const collections = ref<ServerCollection[]>([])
  const state = ref<LoadState>('idle')
  const error = ref<string | null>(null)
  const sourceFailures = ref<ServerSourceFailure[]>([])
  const loadedAt = ref<number | null>(null)
  const lastRealtimeAt = ref<number | null>(null)

  const servers = computed<CfsmServer[]>(() => collections.value.flatMap((item) => item.servers))
  const bySourceAndId = computed(() => new Map(
    servers.value.map((server) => [serverKey(server.source.base, server.id), server]),
  ))

  function findServer(base: string, id: string): CfsmServer | undefined {
    return bySourceAndId.value.get(serverKey(base, id))
  }

  async function load(bases = getApiBases()): Promise<void> {
    state.value = 'loading'
    error.value = null
    sourceFailures.value = []
    try {
      const result = await fetchAllServerSources(bases)
      const previousByBase = new Map(
        collections.value.map((collection) => [collection.source.base, collection]),
      )
      const refreshedByBase = new Map(
        result.collections.map((collection) => [collection.source.base, collection]),
      )
      for (const failure of result.failures) {
        const previous = previousByBase.get(failure.source.base)
        if (previous) refreshedByBase.set(failure.source.base, previous)
      }
      collections.value = bases.flatMap((base) => {
        const collection = refreshedByBase.get(base)
        return collection ? [collection] : []
      })
      sourceFailures.value = result.failures
      if (result.collections.length > 0) loadedAt.value = Date.now()

      if (result.failures.length === 0) {
        state.value = 'ready'
      } else if (collections.value.length > 0) {
        state.value = 'partial'
      } else {
        state.value = 'error'
        error.value = result.failures.map((failure) => failure.message).join('; ')
      }
    } catch (reason) {
      state.value = collections.value.length > 0 ? 'partial' : 'error'
      error.value = reason instanceof Error ? reason.message : 'Unknown CFSM server error'
    }
  }

  function applyRealtimeSamples(
    base: string,
    samples: readonly CfsmRealtimeSample[],
    receivedAt = Date.now(),
  ): void {
    const collectionIndex = collections.value.findIndex((item) => item.source.base === base)
    const collection = collections.value[collectionIndex]
    if (collectionIndex < 0 || !collection || samples.length === 0) return

    const updated = new Map(collection.servers.map((server) => [server.id, server]))
    let changed = false
    for (const sample of samples) {
      const current = updated.get(sample.serverId)
      if (!current) continue
      updated.set(sample.serverId, mergeRealtimeSample(current, sample, receivedAt))
      changed = true
    }
    if (!changed) return

    const nextCollection: ServerCollection = {
      ...collection,
      servers: collection.servers.map((server) => updated.get(server.id) ?? server),
    }
    collections.value = collections.value.map((item, index) => (
      index === collectionIndex ? nextCollection : item
    ))
    lastRealtimeAt.value = receivedAt
  }

  function expireStaleServers(now = Date.now()): void {
    let changed = false
    const nextCollections = collections.value.map((collection) => ({
      ...collection,
      servers: collection.servers.map((server) => {
        if (!server.online) return server
        const updatedAt = timestampMilliseconds(server.lastUpdated ?? server.timestamp)
        if (updatedAt === null || (updatedAt <= now + FIVE_MINUTES_MS && now - updatedAt <= FIVE_MINUTES_MS)) {
          return server
        }
        changed = true
        return { ...server, online: false }
      }),
    }))
    if (changed) collections.value = nextCollections
  }

  function clear(): void {
    collections.value = []
    state.value = 'idle'
    error.value = null
    sourceFailures.value = []
    loadedAt.value = null
    lastRealtimeAt.value = null
  }

  return {
    collections,
    servers,
    state,
    error,
    sourceFailures,
    loadedAt,
    lastRealtimeAt,
    findServer,
    load,
    applyRealtimeSamples,
    expireStaleServers,
    clear,
  }
})
