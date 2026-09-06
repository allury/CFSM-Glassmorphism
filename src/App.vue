<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const siteTitle = computed(() => app.config?.siteTitle ?? 'CFSM Glassmorphism')
const versionLabel = computed(() => app.config?.version ? 'CFSM ' + app.config.version : 'CFSM')

onMounted(() => {
  void app.initialize()
})
</script>

<template>
  <main class="foundation-shell">
    <section class="glass-panel" aria-labelledby="site-title">
      <p class="eyebrow">
        CF Server Monitor · Glassmorphism
      </p>
      <h1 id="site-title">
        {{ siteTitle }}
      </h1>

      <div
        v-if="app.state === 'loading' || app.state === 'idle'"
        class="status-row"
        aria-live="polite"
      >
        <span class="status-dot status-dot--pending" />
        正在读取 CFSM 公共配置…
      </div>

      <div
        v-else-if="app.state === 'error'"
        class="status-card status-card--error"
        role="alert"
      >
        <strong>暂时无法读取站点配置</strong>
        <span>{{ app.error }}</span>
      </div>

      <div
        v-else
        class="status-card"
        aria-live="polite"
      >
        <span class="status-dot status-dot--ready" />
        <span>公共 API 已连接</span>
        <span class="separator" aria-hidden="true">·</span>
        <span>{{ versionLabel }}</span>
      </div>

      <p class="phase-note">
        当前为工程奠基版本：数据契约、鉴权传输、适配层与质量门禁已经建立。
        首页、实时订阅、详情和图表将在对应阶段实现。
      </p>

      <a
        v-if="app.administrationUrl"
        class="admin-link"
        :href="app.administrationUrl"
      >
        前往 CFSM 管理端
      </a>
    </section>

    <footer>
      Powered by
      <a href="https://github.com/allury/CF-Server-Monitor">CF-Server-Monitor</a>
    </footer>
  </main>
</template>
