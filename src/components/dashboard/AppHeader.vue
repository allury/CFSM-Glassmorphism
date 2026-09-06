<script setup lang="ts">
defineProps<{
  title: string
  version: string | null
  loading: boolean
  online: number
  total: number
  sourceCount: number
  adminUrl: string | null
}>()

defineEmits<{
  refresh: []
}>()
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">C</span>
        <div class="brand__copy">
          <strong>{{ title }}</strong>
          <span>
            CFSM Glassmorphism
            <template v-if="version">· v{{ version }}</template>
          </span>
        </div>
      </div>

      <div class="header-status" aria-label="REST 数据状态">
        <span
          class="status-dot"
          :class="loading ? 'status-dot--pending' : 'status-dot--online'"
        />
        <span>{{ online }}/{{ total }} 在线</span>
        <span class="header-status__divider" aria-hidden="true" />
        <span>{{ sourceCount }} 个数据源</span>
      </div>

      <div class="header-actions">
        <button
          class="icon-button"
          type="button"
          :disabled="loading"
          aria-label="刷新 REST 数据"
          title="刷新 REST 数据"
          @click="$emit('refresh')"
        >
          <span aria-hidden="true">↻</span>
        </button>
        <a
          v-if="adminUrl"
          class="admin-button"
          :href="adminUrl"
        >
          管理端
        </a>
      </div>
    </div>
  </header>
</template>
