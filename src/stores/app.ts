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
  let initializeInFlight: Promise<void> | null = null
  let initializeRevision = 0

  const primaryBase = computed(() => apiBases.value[0] ?? null)
  const administrationUrl = computed(() => (
    primaryBase.value ? adminUrl(primaryBase.value) : null
  ))

  async function performInitialize(expectedRevision: number): Promise<void> {
    state.value = 'loading'
    error.value = null

    try {
      apiBases.value = getApiBases()
      const base = apiBases.value[0]
      if (!base) throw new Error('No CFSM API base is configured')
      const nextConfig = await fetchSiteConfig(base)
      if (expectedRevision !== initializeRevision) return
      config.value = nextConfig
      state.value = 'ready'
    } catch (reason) {
      if (expectedRevision !== initializeRevision) return
      // 手动刷新失败时保留上一次真实配置；冷启动本来就是 null，仍按失败态走 fallback。
      state.value = 'error'
      error.value = errorMessage(reason)
    }
  }

  function initialize(): Promise<void> {
    // 首页离开时请求不会被销毁；详情/设置若在它完成前接手，复用同一个配置请求。
    if (initializeInFlight) return initializeInFlight
    const expectedRevision = ++initializeRevision
    const pending = performInitialize(expectedRevision)
    initializeInFlight = pending
    void pending.then(
      () => {
        if (initializeInFlight === pending) initializeInFlight = null
      },
      () => {
        if (initializeInFlight === pending) initializeInFlight = null
      },
    )
    return pending
  }

  function applyConfig(nextConfig: SiteConfig): void {
    // 保存设置后的回读结果比任何更早启动的初始化请求更新。
    initializeRevision += 1
    initializeInFlight = null
    config.value = nextConfig
    state.value = 'ready'
    error.value = null
  }

  return {
    apiBases,
    config,
    state,
    error,
    primaryBase,
    administrationUrl,
    initialize,
    applyConfig,
  }
})
