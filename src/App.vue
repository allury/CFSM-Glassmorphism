<script setup lang="ts">
import { watch } from 'vue'
import AppToaster from '@/components/ui/AppToaster.vue'
import { useAppStore } from '@/stores/app'
import { useThemeSettingsStore } from '@/stores/theme-settings'

const app = useAppStore()
const theme = useThemeSettingsStore()

theme.initialize()
watch(() => app.config, (config) => {
  if (config) theme.hydrateBackend(config.themeOptions, config.preferredTheme)
}, { immediate: true })
</script>

<template>
  <RouterView />
  <AppToaster />
</template>
