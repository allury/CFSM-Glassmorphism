<script setup lang="ts">
import type { DashboardSort, DashboardViewMode } from '@/types/glassmorphism'
import { ALL_GROUPS } from '@/domain/dashboard'

defineProps<{
  query: string
  group: string
  sort: DashboardSort
  viewMode: DashboardViewMode
  groups: string[]
  resultCount: number
}>()

defineEmits<{
  'update:query': [value: string]
  'update:group': [value: string]
  'update:sort': [value: DashboardSort]
  'update:viewMode': [value: DashboardViewMode]
}>()

function inputValue(event: Event): string {
  return event.target instanceof HTMLInputElement ? event.target.value : ''
}

function selectValue(event: Event): string {
  return event.target instanceof HTMLSelectElement ? event.target.value : ''
}

function sortValue(event: Event): DashboardSort {
  const value = selectValue(event)
  if (value === 'name' || value === 'status' || value === 'cpu'
    || value === 'memory' || value === 'network') return value
  return 'order'
}
</script>

<template>
  <section class="dashboard-controls" aria-label="节点筛选与布局">
    <label class="search-field">
      <span class="sr-only">搜索节点</span>
      <span aria-hidden="true">⌕</span>
      <input
        type="search"
        :value="query"
        placeholder="搜索名称、分组、标签、地区、系统…"
        @input="$emit('update:query', inputValue($event))"
      >
    </label>

    <label class="select-field">
      <span>分组</span>
      <select
        :value="group"
        @change="$emit('update:group', selectValue($event))"
      >
        <option :value="ALL_GROUPS">
          全部分组
        </option>
        <option
          v-for="item in groups"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>
    </label>

    <label class="select-field">
      <span>排序</span>
      <select
        :value="sort"
        @change="$emit('update:sort', sortValue($event))"
      >
        <option value="order">后台顺序</option>
        <option value="name">名称</option>
        <option value="status">在线优先</option>
        <option value="cpu">CPU 从高到低</option>
        <option value="memory">内存从高到低</option>
        <option value="network">实时速率从高到低</option>
      </select>
    </label>

    <span class="result-count">{{ resultCount }} 台节点</span>

    <div class="view-switch" aria-label="布局">
      <button
        type="button"
        :class="{ 'is-active': viewMode === 'card' }"
        :aria-pressed="viewMode === 'card'"
        @click="$emit('update:viewMode', 'card')"
      >
        卡片
      </button>
      <button
        type="button"
        :class="{ 'is-active': viewMode === 'list' }"
        :aria-pressed="viewMode === 'list'"
        @click="$emit('update:viewMode', 'list')"
      >
        列表
      </button>
    </div>
  </section>
</template>
