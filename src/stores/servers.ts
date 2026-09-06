import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CfsmServer, ServerCollection, ServerSourceFailure } from '@/types/cfsm'
import { fetchAllServerSources, getApiBases } from '@/services/cfsm'
import type { LoadState } from './app'

function serverKey(base: string, id: string): string {
  return base + '::' + id
}

export const useServersStore = defineStore('servers', () => {
  const collections = ref<ServerCollection[]>([])
  const state = ref<LoadState>('idle')
  const error = ref<string | null>(null)
  const sourceFailures = ref<ServerSourceFailure[]>([])
  const loadedAt = ref<number | null>(null)

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
      collections.value = result.collections
      sourceFailures.value = result.failures
      loadedAt.value = Date.now()

      if (result.failures.length === 0) {
        state.value = 'ready'
      } else if (result.collections.length > 0) {
        state.value = 'partial'
      } else {
        state.value = 'error'
        error.value = result.failures.map((failure) => failure.message).join('; ')
      }
    } catch (reason) {
      collections.value = []
      state.value = 'error'
      error.value = reason instanceof Error ? reason.message : 'Unknown CFSM server error'
    }
  }

  function clear(): void {
    collections.value = []
    state.value = 'idle'
    error.value = null
    sourceFailures.value = []
    loadedAt.value = null
  }

  return {
    collections,
    servers,
    state,
    error,
    sourceFailures,
    loadedAt,
    findServer,
    load,
    clear,
  }
})
