import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { SiteConfig } from '@/types/cfsm'
import { adminUrl, fetchSiteConfig, getApiBases } from '@/services/cfsm'

export type LoadState = 'idle' | 'loading' | 'ready' | 'partial' | 'error'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown CFSM configuration error'
}

export const useAppStore = defineStore('app', () => {
  const apiBases = ref<string[]>([])
  const config = ref<SiteConfig | null>(null)
  const state = ref<LoadState>('idle')
  const error = ref<string | null>(null)

  const primaryBase = computed(() => apiBases.value[0] ?? null)
  const administrationUrl = computed(() => (
    primaryBase.value ? adminUrl(primaryBase.value) : null
  ))

  async function initialize(): Promise<void> {
    state.value = 'loading'
    error.value = null

    try {
      apiBases.value = getApiBases()
      const base = apiBases.value[0]
      if (!base) throw new Error('No CFSM API base is configured')
      config.value = await fetchSiteConfig(base)
      state.value = 'ready'
    } catch (reason) {
      config.value = null
      state.value = 'error'
      error.value = errorMessage(reason)
    }
  }

  return {
    apiBases,
    config,
    state,
    error,
    primaryBase,
    administrationUrl,
    initialize,
  }
})
