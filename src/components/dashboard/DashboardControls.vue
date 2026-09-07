<script setup lang="ts">
import type { DashboardSort, DashboardViewMode } from '@/types/glassmorphism'
import { ALL_GROUPS } from '@/domain/dashboard'

const viewOptions: ReadonlyArray<{ value: DashboardViewMode, label: string, icon: string }> = [
  { value: 'card', label: '卡片', icon: '▦' },
  { value: 'compact', label: '紧凑', icon: '▥' },
  { value: 'mini', label: '迷你', icon: '▤' },
  { value: 'list', label: '列表', icon: '☷' },
]

defineProps<{
  query: string
  group: string
  sort: DashboardSort
  viewMode: DashboardViewMode
  groups: string[]
  resultCount: number
  favoritesOnly: boolean
  favoriteCount: number
  offlineLast: boolean
}>()

defineEmits<{
  'update:query': [value: string]
  'update:group': [value: string]
  'update:sort': [value: DashboardSort]
  'update:viewMode': [value: DashboardViewMode]
  'update:favoritesOnly': [value: boolean]
  'update:offlineLast': [value: boolean]
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
    <div class="group-tabs" role="tablist" aria-label="节点分组">
      <button
        type="button"
        role="tab"
        :aria-selected="group === ALL_GROUPS"
        :class="{ 'is-active': group === ALL_GROUPS }"
        @click="$emit('update:group', ALL_GROUPS)"
      >
        全部节点
      </button>
      <button
        v-for="item in groups"
        :key="item"
        type="button"
        role="tab"
        :aria-selected="group === item"
        :class="{ 'is-active': group === item }"
        @click="$emit('update:group', item)"
      >
        {{ item }}
      </button>
    </div>

    <div class="dashboard-controls__row">
      <div class="quick-controls" aria-label="快捷筛选">
        <button
          type="button"
          :class="{ 'is-active': favoritesOnly }"
          :aria-pressed="favoritesOnly"
          @click="$emit('update:favoritesOnly', !favoritesOnly)"
        >
          <span aria-hidden="true">★</span>
          收藏
          <small>{{ favoriteCount }}</small>
        </button>
        <button
          type="button"
          :class="{ 'is-active': offlineLast }"
          :aria-pressed="offlineLast"
          @click="$emit('update:offlineLast', !offlineLast)"
        >
          <span class="quick-controls__dot" aria-hidden="true" />
          离线置底
        </button>
      </div>

      <div class="dashboard-controls__actions">
        <label class="search-field">
          <span class="sr-only">搜索节点</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input
            type="search"
            :value="query"
            placeholder="搜索名称、分组、标签、地区、系统…"
            @input="$emit('update:query', inputValue($event))"
          >
        </label>

        <label class="select-field">
          <span class="sr-only">节点排序</span>
          <select :value="sort" @change="$emit('update:sort', sortValue($event))">
            <option value="order">后台顺序</option>
            <option value="name">名称</option>
            <option value="status">在线优先</option>
            <option value="cpu">CPU 从高到低</option>
            <option value="memory">内存从高到低</option>
            <option value="network">实时速率从高到低</option>
          </select>
        </label>

        <span class="result-count">{{ resultCount }} 台</span>

        <div class="view-switch" aria-label="卡片布局">
          <button
            v-for="option in viewOptions"
            :key="option.value"
            type="button"
            :class="{ 'is-active': viewMode === option.value }"
            :aria-pressed="viewMode === option.value"
            :aria-label="`${option.label}视图`"
            :title="`${option.label}视图`"
            @click="$emit('update:viewMode', option.value)"
          >
            <span aria-hidden="true">{{ option.icon }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
