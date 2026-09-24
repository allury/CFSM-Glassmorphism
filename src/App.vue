<script setup lang="ts">
import { computed, provide, readonly, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DynamicBackground from '@/components/dashboard/DynamicBackground.vue'
import LoadingCover from '@/components/dashboard/LoadingCover.vue'
import AppToaster from '@/components/ui/AppToaster.vue'
import { bootstrapKey, coldStartSettled, startBootstrapRequests, type EntryPage } from '@/domain/bootstrap'
import { captureInjectedSiteTitle, injectedSiteTitleKey, type InjectedSiteTitle } from '@/domain/site-title'
import { getApiBases } from '@/services/cfsm/config'
import { useAppStore } from '@/stores/app'
import { useServersStore } from '@/stores/servers'
import type { DetailLoadState } from '@/stores/server-detail'
import { useThemeSettingsStore } from '@/stores/theme-settings'

// App runs before RouterView children: take this snapshot before their document.title watchers.
let injectedSiteTitle: InjectedSiteTitle | null = null
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  try {
    injectedSiteTitle = captureInjectedSiteTitle(document.title, window.location.origin, getApiBases())
  } catch {
    // Invalid or unavailable apiBase cannot establish the HTML title's ownership.
  }
}
provide(injectedSiteTitleKey, injectedSiteTitle)

const app = useAppStore()
const servers = useServersStore()
const theme = useThemeSettingsStore()
const route = useRoute()
const coverVisible = ref(true)
const entryDetailState = ref<DetailLoadState>('idle')
let initialPageClaimed = false

provide(bootstrapKey, {
  coverVisible: readonly(coverVisible),
  claimInitialPage() {
    if (initialPageClaimed) return false
    initialPageClaimed = true
    return true
  },
  reportDetailState(state) {
    entryDetailState.value = state
  },
})

theme.initialize()
// Start existing store requests while the lazy route chunk is still downloading.
// A settings deep link never needs the list; page consumers reuse in-flight work.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startBootstrapRequests(window.location.hash, app.initialize, servers.load)
}

const currentPage = computed<EntryPage | null>(() => {
  if (route.name === 'home') return 'home'
  if (route.name === 'server-detail') return 'server-detail'
  if (route.name === 'theme-settings') return 'theme-settings'
  return null
})
watch([currentPage, () => app.state, () => servers.state, entryDetailState], () => {
  if (coverVisible.value && coldStartSettled(currentPage.value, app.state, servers.state, entryDetailState.value)) {
    coverVisible.value = false
  }
}, { immediate: true, flush: 'sync' })

watch(() => app.config, (config) => {
  if (config) theme.hydrateBackend(config.themeOptions, config.preferredTheme)
}, { immediate: true })
watch(() => app.state, (state) => {
  if (state === 'error' && app.config === null) theme.resolveConfigFailure()
}, { immediate: true })
</script>

<template>
  <DynamicBackground />
  <Transition
    :css="!theme.runtime.disablePageAnimation"
    enter-active-class="loading-cover-enter-active"
    enter-from-class="loading-cover-enter-from"
    enter-to-class="loading-cover-enter-to"
    leave-active-class="loading-cover-leave-active"
    leave-from-class="loading-cover-leave-from"
    leave-to-class="loading-cover-leave-to"
  >
    <LoadingCover v-if="coverVisible" />
  </Transition>
  <RouterView />
  <AppToaster />
</template>
