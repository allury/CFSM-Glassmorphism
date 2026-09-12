<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/dashboard/AppHeader.vue'
import DynamicBackground from '@/components/dashboard/DynamicBackground.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import {
  isFieldEnabled,
  THEME_SETTINGS_FORM,
  type ThemeField,
} from '@/domain/theme-settings-form'
import { useAppStore } from '@/stores/app'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { THEME_SETTING_KEYS, type ThemeSettings } from '@/theme/settings'
import { message } from '@/utils/message'

/*
 * Komari 自己没有设置页：48 项设置写在 `komari-theme.json` 的 managed configuration 里，
 * 由 Komari 后台渲染。CFSM 没有这套机制（第三方主题只能读 `/api/config.theme_options`、
 * 写 `POST /api/theme_options`），所以设置页由主题自己提供，分组、顺序与标题
 * 逐条对齐上游那份清单——见 `domain/theme-settings-form.ts`。
 *
 * 页面框架（Header、背景、玻璃面板）与首页、详情页共用，不再自建一套顶栏。
 */
const app = useAppStore()
const theme = useThemeSettingsStore()
const router = useRouter()
const copying = ref(false)

const groups = THEME_SETTINGS_FORM
const primaryBase = computed(() => app.primaryBase)
const siteTitle = computed(() => app.config?.siteTitle ?? 'CF Server Monitor')
const authorized = computed(() => (
  app.config?.authorization === true && theme.hasBackendCredential
))
const visibleAdminUrl = computed(() => (
  theme.runtime.hideAdminEntryWhenLoggedOut && app.config?.authorization !== true
    ? null
    : app.administrationUrl
))
const backendLabel = computed(() => {
  if (!primaryBase.value) return '未配置 CFSM 数据源'
  try {
    return new URL(primaryBase.value).host
  } catch {
    return primaryBase.value
  }
})
const backendSaveCopy = computed(() => {
  const failure = theme.saveError
  if (!failure) return null
  if (failure.kind === 'invalid-format') {
    return failure.code === 'invalidThemeOptionsFormat'
      ? 'CFSM 拒绝了 theme_options 格式。草稿已保留，请修正后重试。'
      : `CFSM 拒绝了当前配置：${failure.message}`
  }
  if (failure.kind === 'unauthorized') {
    return 'JWT 无效或已过期。凭证已清除，请先在 CFSM 官方管理端重新登录；当前草稿未丢失。'
  }
  if (failure.kind === 'forbidden') {
    return 'Turnstile 验证失败。一次性与复用凭证已清除，请完成 CFSM 验证后重试；当前草稿未丢失。'
  }
  if (failure.kind === 'network') {
    return '网络请求未完成。当前草稿仍保留在页面中，可以稍后重试。'
  }
  return failure.message
})
const snapshotJson = computed(() => JSON.stringify(theme.draftSnapshot, null, 2))

/** 上游把分组写成「01 · 基础与外观」，这里拆成序号徽标与标题两段显示。 */
function groupIndex(title: string): string {
  return title.split(' · ')[0] ?? ''
}

function groupTitle(title: string): string {
  return title.split(' · ')[1] ?? title
}

function issueFor(key: keyof ThemeSettings): string | null {
  return theme.draftIssues.find((issue) => issue.key === key)?.message ?? null
}

function fieldEnabled(field: ThemeField): boolean {
  return isFieldEnabled(field, theme.draft)
}

function textValue(key: keyof ThemeSettings): string {
  const value = theme.draft[key]
  return typeof value === 'string' ? value : ''
}

function numberValue(key: keyof ThemeSettings): number | null {
  const value = theme.draft[key]
  return typeof value === 'number' ? value : null
}

function booleanValue(key: keyof ThemeSettings): boolean {
  return theme.draft[key] === true
}

/*
 * 草稿是一份完整的 `ThemeSettings`，这里按控件类型写回单个键。
 * 值域与类型校验仍然只有一处——`theme/settings.ts` 的 schema，
 * 页面不重复实现，也不在写回时悄悄纠正用户输入。
 */
function setValue(key: keyof ThemeSettings, value: string | number | boolean): void {
  Object.assign(theme.draft, { [key]: value })
}

function onText(key: keyof ThemeSettings, event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    setValue(key, target.value)
  }
}

function onSelect(key: keyof ThemeSettings, event: Event): void {
  const target = event.target
  if (target instanceof HTMLSelectElement) setValue(key, target.value)
}

function onSwitch(key: keyof ThemeSettings, event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) setValue(key, target.checked)
}

/** 清空输入框时保留原值，不把空串写成 NaN 让 schema 报一条假错误。 */
function onNumber(key: keyof ThemeSettings, event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  if (target.value === '') return
  const parsed = Number(target.value)
  if (Number.isFinite(parsed)) setValue(key, parsed)
}

async function saveBackend(): Promise<void> {
  const base = primaryBase.value
  if (!base || !authorized.value) return
  const outcome = await theme.saveBackend(base)
  if (outcome.config) app.applyConfig(outcome.config)
}

async function copySnapshot(): Promise<void> {
  copying.value = true
  try {
    if (!navigator.clipboard) throw new Error('Clipboard API is unavailable')
    await navigator.clipboard.writeText(snapshotJson.value)
    message.info('完整规范化快照已复制。')
  } catch {
    message.info('浏览器未允许写入剪贴板；可展开下方 JSON 手动复制。')
  } finally {
    copying.value = false
  }
}

watch(() => theme.draft, () => theme.previewDraft(), { deep: true })

/*
 * 与 Komari `utils/message.ts` 一致：瞬时结果反馈走 sonner toast，不在页面内常驻。
 * 草稿校验问题仍留在页面里，因为它需要持续可见直到被修正。
 */
watch(() => theme.message, (text) => {
  if (text) message.success(text)
})

watch(backendSaveCopy, (copy) => {
  if (!copy) return
  const failure = theme.saveError
  const detail = failure?.status ? `HTTP ${failure.status} · ${failure.code ?? 'unknown'}` : undefined
  message.error(copy, detail)
})

watch(() => theme.refetchWarning, (warning) => {
  if (warning) message.info(`配置回读错误：${warning}`)
})

onMounted(async () => {
  if (app.state === 'idle' || app.state === 'error') await app.initialize()
  document.title = `主题设置 · ${siteTitle.value}`
})
</script>

<template>
  <div class="app-root settings-root">
    <DynamicBackground />
    <div class="app-shell">
      <AppHeader
        :title="siteTitle"
        :version="app.config?.version ?? null"
        :loading="app.state === 'loading'"
        :admin-url="visibleAdminUrl"
        :theme-mode="theme.runtime.themeMode"
        :show-status="false"
        @refresh="app.initialize"
        @cycle-theme="theme.cycleTheme"
      />

      <main class="settings-page">
        <section class="settings-intro glass-panel">
          <div class="settings-intro__copy">
            <button class="detail-back" type="button" @click="router.push({ name: 'home' })">
              <AppIcon name="tabler:arrow-left" :size="14" />
              <span>返回节点列表</span>
            </button>
            <h1>主题设置</h1>
            <p>
              全部 {{ THEME_SETTING_KEYS.length }} 项与上游主题清单一一对应。修改会立即预览，
              只有明确保存后才写入本浏览器或 CFSM 后端。
            </p>
          </div>
          <dl class="settings-layer-stats">
            <div>
              <dt>配置来源</dt>
              <dd>默认 → 后端 → 本地</dd>
            </div>
            <div>
              <dt>后端</dt>
              <dd>{{ backendLabel }}</dd>
            </div>
            <div>
              <dt>本地覆盖</dt>
              <dd>{{ theme.localOverrideCount }} 项</dd>
            </div>
            <div>
              <dt>预览</dt>
              <dd>{{ theme.hasDraftChanges ? '有未保存修改' : '已同步' }}</dd>
            </div>
          </dl>
        </section>

        <div v-if="app.state === 'error'" class="notice notice--warning" role="alert">
          <strong>无法读取 /api/config</strong>
          <span>{{ app.error }}。可以继续编辑并保存本地；后端保存需先恢复配置连接。</span>
          <button type="button" @click="app.initialize">
            重新读取
          </button>
        </div>

        <form class="settings-layout" @submit.prevent>
          <div class="settings-sections">
            <section v-for="group in groups" :key="group.title" class="settings-section glass-panel">
              <header>
                <div>
                  <span class="settings-section__index">{{ groupIndex(group.title) }}</span>
                  <h2>{{ groupTitle(group.title) }}</h2>
                </div>
              </header>

              <div class="settings-fields settings-fields--two">
                <template v-for="field in group.fields" :key="field.key">
                  <label
                    v-if="field.kind === 'switch'"
                    class="settings-switch"
                    :class="{ 'settings-field--wide': field.wide, 'is-unsupported': field.unsupported }"
                  >
                    <input
                      type="checkbox"
                      :checked="booleanValue(field.key)"
                      :disabled="!fieldEnabled(field)"
                      @change="onSwitch(field.key, $event)"
                    >
                    <span>
                      <strong>
                        {{ field.label }}
                        <em v-if="field.unsupported" class="settings-badge">CFSM 不支持</em>
                      </strong>
                      <small>{{ field.unsupported ?? field.help }}</small>
                      <small v-if="!field.unsupported && field.note" class="settings-note">{{ field.note }}</small>
                    </span>
                  </label>

                  <label
                    v-else
                    class="settings-field"
                    :class="{ 'settings-field--wide': field.wide, 'is-unsupported': field.unsupported }"
                  >
                    <span>
                      {{ field.label }}
                      <em v-if="field.unsupported" class="settings-badge">CFSM 不支持</em>
                    </span>

                    <select
                      v-if="field.kind === 'select'"
                      :value="textValue(field.key)"
                      :disabled="!fieldEnabled(field)"
                      @change="onSelect(field.key, $event)"
                    >
                      <option v-for="option in field.options" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>

                    <span v-else-if="field.kind === 'number'" class="settings-number">
                      <input
                        type="number"
                        :value="numberValue(field.key)"
                        :min="field.min"
                        :max="field.max"
                        :disabled="!fieldEnabled(field)"
                        @input="onNumber(field.key, $event)"
                      >
                      <i>{{ field.unit }}</i>
                    </span>

                    <textarea
                      v-else-if="field.kind === 'textarea'"
                      :value="textValue(field.key)"
                      :rows="field.rows ?? 3"
                      :disabled="!fieldEnabled(field)"
                      spellcheck="false"
                      @input="onText(field.key, $event)"
                    />

                    <input
                      v-else
                      :type="field.kind === 'password' ? 'password' : 'text'"
                      :value="textValue(field.key)"
                      :disabled="!fieldEnabled(field)"
                      :autocomplete="field.kind === 'password' ? 'new-password' : 'off'"
                      @input="onText(field.key, $event)"
                    >

                    <small :class="{ 'is-error': issueFor(field.key) }">
                      {{ issueFor(field.key) ?? field.unsupported ?? field.help }}
                    </small>
                    <small v-if="!field.unsupported && field.note" class="settings-note">{{ field.note }}</small>
                  </label>
                </template>
              </div>
            </section>
          </div>

          <aside class="settings-save-panel glass-panel">
            <span class="eyebrow">PERSISTENCE</span>
            <h2>保存设置</h2>
            <p>
              本地覆盖只影响当前浏览器；后端保存会提交包含 {{ THEME_SETTING_KEYS.length }} 个已知项和
              兼容未知项的完整对象。
            </p>

            <div v-if="theme.draftIssues.length" class="settings-save-alert is-error" role="alert">
              <strong>需要修正 {{ theme.draftIssues.length }} 项</strong>
              <span v-for="issue in theme.draftIssues" :key="issue.key">{{ issue.message }}</span>
            </div>

            <button class="settings-action settings-action--primary" type="button" :disabled="!theme.canSaveDraft" @click="theme.saveLocal">
              保存到此浏览器
            </button>
            <button class="settings-action" type="button" :disabled="theme.saveState === 'saving'" @click="theme.useBackend">
              使用后端配置
            </button>
            <button
              class="settings-action settings-action--backend"
              type="button"
              :disabled="!authorized || !primaryBase || !theme.canSaveDraft"
              @click="saveBackend"
            >
              {{ theme.saveState === 'saving' ? '正在保存并回读…' : '保存到 CFSM 后端' }}
            </button>
            <p v-if="!authorized" class="settings-auth-note">
              当前未登录，后端保存已禁用。请使用 <a v-if="app.administrationUrl" :href="app.administrationUrl">CFSM 官方管理端</a><span v-else>CFSM 官方管理端</span>登录后再试。
            </p>
            <p v-else-if="app.config?.turnstileEnabled" class="settings-auth-note">
              保存将复用当前 CFSM Turnstile Token / Verified 凭证；HTTP 403 会清除失效凭证并保留草稿。
            </p>

            <button class="settings-action settings-action--quiet" type="button" :disabled="copying" @click="copySnapshot">
              {{ copying ? '正在复制…' : '复制完整 JSON' }}
            </button>
            <button v-if="theme.hasDraftChanges" class="settings-action settings-action--quiet" type="button" @click="theme.resetDraft">
              放弃未保存预览
            </button>

            <details class="settings-json-preview">
              <summary>查看将保存的完整快照</summary>
              <pre>{{ snapshotJson }}</pre>
            </details>
          </aside>
        </form>
      </main>
    </div>
  </div>
</template>
