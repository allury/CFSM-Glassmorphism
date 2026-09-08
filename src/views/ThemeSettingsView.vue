<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DynamicBackground from '@/components/dashboard/DynamicBackground.vue'
import { useAppStore } from '@/stores/app'
import { useThemeSettingsStore } from '@/stores/theme-settings'
import { THEME_SETTING_KEYS, type ThemeSettings } from '@/theme/settings'

const app = useAppStore()
const theme = useThemeSettingsStore()
const router = useRouter()
const copying = ref(false)
const copyMessage = ref<string | null>(null)

const primaryBase = computed(() => app.primaryBase)
const authorized = computed(() => (
  app.config?.authorization === true && theme.hasBackendCredential
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

function issueFor(key: keyof ThemeSettings): string | null {
  return theme.draftIssues.find((issue) => issue.key === key)?.message ?? null
}

async function saveBackend(): Promise<void> {
  const base = primaryBase.value
  if (!base || !authorized.value) return
  const outcome = await theme.saveBackend(base)
  if (outcome.config) app.applyConfig(outcome.config)
}

async function copySnapshot(): Promise<void> {
  copying.value = true
  copyMessage.value = null
  try {
    if (!navigator.clipboard) throw new Error('Clipboard API is unavailable')
    await navigator.clipboard.writeText(snapshotJson.value)
    copyMessage.value = '完整规范化快照已复制。'
  } catch {
    copyMessage.value = '浏览器未允许写入剪贴板；可展开下方 JSON 手动复制。'
  } finally {
    copying.value = false
  }
}

watch(() => theme.draft, () => theme.previewDraft(), { deep: true })

onMounted(async () => {
  if (app.state === 'idle' || app.state === 'error') await app.initialize()
  document.title = `主题设置 · ${app.config?.siteTitle ?? 'CF Server Monitor'}`
})
</script>

<template>
  <div class="app-root settings-root">
    <DynamicBackground />
    <div class="app-shell">
      <header class="settings-header">
        <div class="settings-header__inner">
          <button class="detail-back" type="button" @click="router.push({ name: 'home' })">
            <span aria-hidden="true">←</span>
            <span>返回节点列表</span>
          </button>
          <div class="settings-header__brand">
            <strong>Theme Settings</strong>
            <span>CFSM Glassmorphism</span>
          </div>
          <button class="icon-button" type="button" aria-label="切换主题" @click="theme.cycleTheme">
            <span aria-hidden="true">
              ◐
            </span>
          </button>
        </div>
      </header>

      <main class="settings-page">
        <section class="settings-hero glass-panel">
          <div>
            <span class="eyebrow">CONFIGURATION</span>
            <h1>主题设置</h1>
            <p>所有组件消费同一份规范化运行时配置；编辑会立即预览，但只有明确保存后才进入本地或 CFSM 后端层。</p>
          </div>
          <div class="settings-layer-flow" aria-label="配置优先级">
            <span><small>1</small> Defaults</span>
            <i aria-hidden="true">→</i>
            <span><small>2</small> Backend</span>
            <i aria-hidden="true">→</i>
            <span :class="{ 'is-active': theme.hasLocalOverrides }"><small>3</small> Local</span>
          </div>
          <dl class="settings-layer-stats">
            <div><dt>Schema</dt><dd>{{ THEME_SETTING_KEYS.length }} 项</dd></div>
            <div><dt>后端</dt><dd>{{ backendLabel }}</dd></div>
            <div><dt>本地覆盖</dt><dd>{{ theme.localOverrideCount }} 项</dd></div>
            <div><dt>预览</dt><dd>{{ theme.hasDraftChanges ? '有未保存修改' : '已同步' }}</dd></div>
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
            <section class="settings-section glass-panel">
              <header>
                <div><span class="settings-section__index">01</span><h2>基础与外观</h2></div>
                <p>主题、布局和毛玻璃配色均实时预览。</p>
              </header>
              <div class="settings-fields settings-fields--two">
                <label class="settings-field">
                  <span>主题模式</span>
                  <select v-model="theme.draft.themeMode">
                    <option value="beijing">北京时间自动</option>
                    <option value="system">跟随系统</option>
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                  </select>
                  <small>北京时间 07:00–18:59 使用浅色，其余时段使用深色。</small>
                </label>
                <label class="settings-field">
                  <span>默认视图</span>
                  <select v-model="theme.draft.defaultViewMode">
                    <option value="card">卡片</option>
                    <option value="list">列表</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span>卡片尺寸</span>
                  <select v-model="theme.draft.nodeCardSize" :disabled="theme.draft.defaultViewMode === 'list'">
                    <option value="mini">迷你</option>
                    <option value="compact">紧凑</option>
                    <option value="comfortable">舒适</option>
                    <option value="large">宽松</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span>毛玻璃配色</span>
                  <select v-model="theme.draft.glassColorPreset">
                    <option value="翡翠">翡翠</option>
                    <option value="柔和">柔和</option>
                    <option value="高对比">高对比</option>
                    <option value="午夜">午夜</option>
                    <option value="自定义">自定义</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span>色觉辅助</span>
                  <select v-model="theme.draft.colorVisionMode">
                    <option value="标准">标准</option>
                    <option value="色觉友好">色觉友好</option>
                  </select>
                </label>
                <label class="settings-switch">
                  <input v-model="theme.draft.disablePageAnimation" type="checkbox">
                  <span><strong>减弱过渡动画</strong><small>同时继续尊重系统的 reduced-motion 偏好。</small></span>
                </label>
              </div>
              <label v-if="theme.draft.glassColorPreset === '自定义'" class="settings-field settings-field--wide">
                <span>自定义毛玻璃颜色 JSON</span>
                <textarea v-model="theme.draft.glassCustomColors" rows="6" spellcheck="false" />
                <small :class="{ 'is-error': issueFor('glassCustomColors') }">
                  {{ issueFor('glassCustomColors') ?? '需要 light/dark 的 card、control、text、mutedText、border 共 10 个十六进制颜色。' }}
                </small>
              </label>
            </section>

            <section class="settings-section glass-panel">
              <header>
                <div><span class="settings-section__index">02</span><h2>首页内容</h2></div>
                <p>只启用当前真实数据和现有组件能够兑现的控制。</p>
              </header>
              <div class="settings-fields settings-fields--two">
                <label class="settings-switch">
                  <input v-model="theme.draft.alertEnabled" type="checkbox">
                  <span><strong>显示首页公告</strong><small>内容按安全纯文本渲染，不执行 HTML。</small></span>
                </label>
                <label class="settings-switch">
                  <input v-model="theme.draft.hideGeneralCard" type="checkbox">
                  <span><strong>隐藏首页总览</strong><small>节点列表与真实状态提示仍然保留。</small></span>
                </label>
                <label class="settings-field">
                  <span>公告标题</span>
                  <input v-model="theme.draft.alertTitle" type="text" :disabled="!theme.draft.alertEnabled">
                </label>
                <label class="settings-field">
                  <span>高负载阈值</span>
                  <span class="settings-number"><input v-model.number="theme.draft.homeHighLoadThreshold" type="number" min="1" max="100"><i>%</i></span>
                  <small :class="{ 'is-error': issueFor('homeHighLoadThreshold') }">{{ issueFor('homeHighLoadThreshold') ?? 'CPU、内存或磁盘达到该值时使用高负载状态。' }}</small>
                </label>
                <label class="settings-field">
                  <span>总览卡片方案</span>
                  <select v-model="theme.draft.generalCardPreset">
                    <option v-for="value in ['官方', '基础', '运维', '资源', '财务', '流量', 'GPU', '资产', '完整', '自定义']" :key="value" :value="value">{{ value }}</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span>快捷控制方案</span>
                  <select v-model="theme.draft.homeQuickControlPreset" :disabled="!theme.draft.homeQuickControlsEnabled">
                    <option v-for="value in ['基础', '流量', '运维', '完整', '自定义']" :key="value" :value="value">{{ value }}</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span>流量预警阈值</span>
                  <span class="settings-number"><input v-model.number="theme.draft.homeTrafficWarningThreshold" type="number" min="1" max="100"><i>%</i></span>
                  <small :class="{ 'is-error': issueFor('homeTrafficWarningThreshold') }">{{ issueFor('homeTrafficWarningThreshold') ?? '仅对可可靠解析的 traffic_limit 生效。' }}</small>
                </label>
                <label class="settings-field">
                  <span>即将到期天数</span>
                  <span class="settings-number"><input v-model.number="theme.draft.homeExpiringDays" type="number" min="1" max="3650"><i>天</i></span>
                  <small :class="{ 'is-error': issueFor('homeExpiringDays') }">{{ issueFor('homeExpiringDays') ?? '使用 CFSM expire_date。' }}</small>
                </label>
              </div>
              <label class="settings-field settings-field--wide">
                <span>公告内容</span>
                <textarea v-model="theme.draft.alertContent" rows="4" :disabled="!theme.draft.alertEnabled" />
              </label>
              <div class="settings-fields settings-fields--two settings-fields--switches">
                <label class="settings-switch"><input v-model="theme.draft.homeQuickControlsEnabled" type="checkbox"><span><strong>显示快捷控制</strong><small>收藏、流量排序与运维筛选。</small></span></label>
                <label class="settings-switch"><input v-model="theme.draft.offlineNodesLast" type="checkbox"><span><strong>离线节点置底</strong><small>沿用统一五分钟在线判定。</small></span></label>
                <label class="settings-switch"><input v-model="theme.draft.nodeListMetadataEnabled" type="checkbox"><span><strong>列表信息栏</strong><small>只展示 CFSM 确实返回的字段。</small></span></label>
                <label class="settings-switch"><input v-model="theme.draft.nodeListCustomTagsVisible" type="checkbox" :disabled="!theme.draft.nodeListMetadataEnabled"><span><strong>列表显示标签</strong><small>还需 fields 包含 tags。</small></span></label>
                <label class="settings-switch"><input v-model="theme.draft.hideAdminEntryWhenLoggedOut" type="checkbox"><span><strong>未登录隐藏后台入口</strong><small>登录后仍指向 /admin#admin。</small></span></label>
                <label class="settings-switch"><input v-model="theme.draft.hidePriceWhenLoggedOut" type="checkbox"><span><strong>未登录隐藏价格</strong><small>不改变 CFSM 服务端权限过滤。</small></span></label>
              </div>
              <label class="settings-field settings-field--wide">
                <span>自定义总览卡片 keys</span>
                <textarea v-model="theme.draft.generalCardKeys" rows="4" :disabled="theme.draft.generalCardPreset !== '自定义'" spellcheck="false" />
                <small>支持真实聚合字段；CFSM 不提供的数据 key 会被忽略，不生成占位值。</small>
              </label>
              <label class="settings-field settings-field--wide">
                <span>自定义快捷控制 keys</span>
                <textarea v-model="theme.draft.homeQuickControlKeys" rows="3" :disabled="!theme.draft.homeQuickControlsEnabled || theme.draft.homeQuickControlPreset !== '自定义'" spellcheck="false" />
                <small>favorite、totalTraffic、upload、download、peak、offline、highLoad、expiring。</small>
              </label>
              <label class="settings-field settings-field--wide">
                <span>列表信息字段 keys</span>
                <textarea v-model="theme.draft.nodeListMetadataFields" rows="3" :disabled="!theme.draft.nodeListMetadataEnabled" spellcheck="false" />
                <small>当前可用：region、group、tags。provider 仅在有可靠别名匹配后显示；city / asn 无公开数据时忽略。</small>
              </label>
              <label class="settings-field settings-field--wide">
                <span>厂商别名</span>
                <input v-model="theme.draft.providerAliases" type="text" placeholder="Provider:alias1,alias2;Provider2:alias">
                <small>只匹配节点 name、group、tags、region 中的真实文本，不通过 IP 猜测厂商。</small>
              </label>
            </section>

            <section class="settings-section glass-panel">
              <header>
                <div><span class="settings-section__index">03</span><h2>详情与图表</h2></div>
                <p>详情继续直接消费第 4.5 轮建立的规范化数据模型。</p>
              </header>
              <div class="settings-fields settings-fields--two">
                <label class="settings-switch">
                  <input v-model="theme.draft.gpuChartEnabled" type="checkbox">
                  <span><strong>显示 GPU 历史图</strong><small>无真实数字序列时仍自动隐藏。</small></span>
                </label>
                <label class="settings-field">
                  <span>详情卡片方案</span>
                  <select v-model="theme.draft.detailMetricCardPreset">
                    <option v-for="value in ['财务', '状态', '资源', '网络', 'GPU', '综合', '自定义']" :key="value" :value="value">{{ value }}</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span>历史图表方案</span>
                  <select v-model="theme.draft.chartDashboardPreset">
                    <option v-for="value in ['默认', '精简', '资源', '网络', 'GPU', '延迟', '运维', '完整', '自定义']" :key="value" :value="value">{{ value }}</option>
                  </select>
                </label>
              </div>
              <label class="settings-field settings-field--wide">
                <span>自定义详情卡片 keys</span>
                <textarea v-model="theme.draft.detailMetricCardKeys" rows="4" :disabled="theme.draft.detailMetricCardPreset !== '自定义'" spellcheck="false" />
                <small>只有 normalized detail model 中存在的字段才显示；缺失数据自动收起。</small>
              </label>
              <label class="settings-field settings-field--wide">
                <span>自定义图表 keys</span>
                <textarea v-model="theme.draft.chartDashboardTemplate" rows="4" :disabled="theme.draft.chartDashboardPreset !== '自定义'" spellcheck="false" />
                <small>cpu、memory、disk、network、traffic、gpu、ping、pingLoss；缺失序列不会合成。</small>
              </label>
            </section>

            <section class="settings-section glass-panel">
              <header>
                <div><span class="settings-section__index">04</span><h2>自定义背景</h2></div>
                <p>只加载 http(s)、站内路径或经过编码的 local: 用户资源路径。</p>
              </header>
              <div class="settings-fields settings-fields--two">
                <label class="settings-switch">
                  <input v-model="theme.draft.backgroundEnabled" type="checkbox">
                  <span><strong>启用自定义背景</strong><small>无有效 URL 时回落到内置动态背景。</small></span>
                </label>
                <label class="settings-field">
                  <span>背景类型</span>
                  <select v-model="theme.draft.backgroundType" :disabled="!theme.draft.backgroundEnabled">
                    <option value="image">图片</option>
                    <option value="video">视频</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span>亮色背景地址</span>
                  <input v-model="theme.draft.lightBackgroundUrl" type="text" :disabled="!theme.draft.backgroundEnabled" placeholder="https://… 或 /path/image.webp">
                  <small :class="{ 'is-error': issueFor('lightBackgroundUrl') }">{{ issueFor('lightBackgroundUrl') ?? 'local:文件名映射到 /themes/user-assets/。' }}</small>
                </label>
                <label class="settings-field">
                  <span>暗色背景地址</span>
                  <input v-model="theme.draft.darkBackgroundUrl" type="text" :disabled="!theme.draft.backgroundEnabled" placeholder="https://… 或 /path/image.webp">
                  <small :class="{ 'is-error': issueFor('darkBackgroundUrl') }">{{ issueFor('darkBackgroundUrl') ?? '留空时该模式使用内置背景。' }}</small>
                </label>
                <label class="settings-field">
                  <span>背景模糊</span>
                  <span class="settings-number"><input v-model.number="theme.draft.backgroundBlur" type="number" min="0" max="80"><i>px</i></span>
                  <small :class="{ 'is-error': issueFor('backgroundBlur') }">{{ issueFor('backgroundBlur') }}</small>
                </label>
                <label class="settings-field">
                  <span>背景遮罩</span>
                  <span class="settings-number"><input v-model.number="theme.draft.backgroundOverlay" type="number" min="-100" max="100"><i>%</i></span>
                  <small :class="{ 'is-error': issueFor('backgroundOverlay') }">{{ issueFor('backgroundOverlay') ?? '正数加深，负数提亮。' }}</small>
                </label>
              </div>
            </section>

            <section class="settings-section settings-section--limitations glass-panel">
              <header>
                <div><span class="settings-section__index">05</span><h2>明确不支持与后续项</h2></div>
              </header>
              <div class="settings-limitations">
                <article><strong>RPC 模式</strong><span>CFSM 固定使用官方 REST + WebSocket，不提供旧主题的传输模式切换。</span></article>
                <article><strong>访客信息</strong><span>公开主题 API 不提供访客 IP 或审计数据，强制关闭且不生成占位信息。</span></article>
                <article><strong>Earth / Map</strong><span>保留兼容配置；本轮没有地理数据能力，不显示伪控制。</span></article>
                <article><strong>高级工具与磁盘预测</strong><span>需要独立交互或足量历史样本的功能继续隐藏，避免无效开关。</span></article>
              </div>
            </section>
          </div>

          <aside class="settings-save-panel glass-panel">
            <span class="eyebrow">PERSISTENCE</span>
            <h2>保存设置</h2>
            <p>本地覆盖只影响当前浏览器；后端保存会提交包含 {{ THEME_SETTING_KEYS.length }} 个已知项和兼容未知项的完整对象。</p>

            <div v-if="theme.draftIssues.length" class="settings-save-alert is-error" role="alert">
              <strong>需要修正 {{ theme.draftIssues.length }} 项</strong>
              <span v-for="issue in theme.draftIssues" :key="issue.key">{{ issue.message }}</span>
            </div>
            <div v-if="backendSaveCopy" class="settings-save-alert is-error" role="alert">
              <strong>后端保存失败</strong>
              <span>{{ backendSaveCopy }}</span>
              <small v-if="theme.saveError?.status">HTTP {{ theme.saveError.status }} · {{ theme.saveError.code ?? 'unknown' }}</small>
            </div>
            <div v-if="theme.message" class="settings-save-alert is-success" role="status">
              <strong>{{ theme.saveState === 'success' ? '操作完成' : '设置状态' }}</strong>
              <span>{{ theme.message }}</span>
              <small v-if="theme.refetchWarning">回读错误：{{ theme.refetchWarning }}</small>
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
            <span v-if="copyMessage" class="settings-copy-message">{{ copyMessage }}</span>

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
