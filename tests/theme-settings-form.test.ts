import { describe, expect, it } from 'vitest'
import {
  isFieldEnabled,
  THEME_FORM_FIELDS,
  THEME_SETTINGS_FORM,
} from '@/domain/theme-settings-form'
import { cloneThemeSettings, DEFAULT_THEME_SETTINGS, THEME_SETTING_KEYS } from '@/theme/settings'

/*
 * 基线是 Komari Glassmorphism v3.3.7 的 `komari-theme.json`：它的
 * `configuration.data` 里 8 条 `type: "title"` 就是分组，分组之间的条目就是字段顺序。
 * CFSM 没有 managed 表单机制，设置页由主题自己渲染，因此这份注册表必须逐条对上，
 * 否则页面又会像第 2 轮那样漏项、并组。
 */
const UPSTREAM_GROUPS: ReadonlyArray<{ title: string, keys: readonly string[] }> = [
  {
    title: '01 · 基础与外观',
    keys: ['themeMode', 'dataUpdateInterval', 'defaultViewMode', 'nodeCardSize'],
  },
  {
    title: '02 · 首页布局',
    keys: [
      'alertEnabled', 'alertTitle', 'alertContent', 'stopEarth', 'earthRenderer',
      'hideEarth', 'hideGeneralCard', 'glassColorPreset',
      'colorVisionMode', 'glassCustomColors',
    ],
  },
  {
    title: '03 · 首页总览卡片',
    keys: ['generalCardPreset', 'generalCardKeys'],
  },
  {
    title: '04 · 高级工具与隐私',
    keys: [
      'homeToolsEnabled', 'hideAdminEntryWhenLoggedOut', 'hidePriceWhenLoggedOut',
      'providerAliases', 'exportSecondaryPassword', 'disablePageAnimation',
    ],
  },
  {
    title: '05 · 节点卡片、列表与快捷控制',
    keys: [
      'homeQuickControlsEnabled', 'homeQuickControlPreset', 'homeQuickControlKeys',
      'nodeListMetadataEnabled', 'nodeListMetadataFields', 'nodeListCustomTagsVisible',
      'offlineNodesLast', 'homeHighLoadThreshold', 'homeTrafficWarningThreshold',
      'homeExpiringDays', 'diskPredictionEnabled', 'diskPredictionThresholdDays',
    ],
  },
  {
    title: '06 · 节点详情概览卡片',
    keys: ['nodeDetailSectionTabsEnabled', 'detailMetricCardPreset', 'detailMetricCardKeys'],
  },
  {
    title: '07 · 节点详情图表',
    keys: ['gpuChartEnabled', 'chartDashboardPreset', 'chartDashboardTemplate'],
  },
  {
    title: '08 · 自定义背景',
    keys: [
      'backgroundEnabled', 'backgroundType', 'lightBackgroundUrl', 'darkBackgroundUrl',
      'backgroundBlur', 'backgroundOverlay',
    ],
  },
]

/*
 * CFSM 公开接口确实不提供的两项：设置页不渲染，避免出现点了没反应的控件。
 * 它们仍留在 48 项 schema 与保存快照中——保存协议要求发送完整对象。
 * 正式版待办见 `docs/todo.md` TODO-02。
 */
const BACKLOG_KEYS: readonly string[] = ['rpcTransportMode', 'visitorInfoEnabled']

describe('设置页字段注册表与上游清单一致', () => {
  it('分组标题与顺序逐条对应 komari-theme.json', () => {
    expect(THEME_SETTINGS_FORM.map((group) => group.title)).toEqual(
      UPSTREAM_GROUPS.map((group) => group.title),
    )
  })

  it('每个分组内的字段顺序与上游一致', () => {
    for (const [index, group] of UPSTREAM_GROUPS.entries()) {
      expect(THEME_SETTINGS_FORM[index]?.fields.map((field) => field.key)).toEqual(group.keys)
    }
  })

  it('除两项待办外，每项设置都有且只有一个控件', () => {
    const keys: string[] = THEME_FORM_FIELDS.map((field) => field.key)
    expect(keys).toHaveLength(THEME_SETTING_KEYS.length - BACKLOG_KEYS.length)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of THEME_SETTING_KEYS) {
      if (BACKLOG_KEYS.includes(key)) expect(keys).not.toContain(key)
      else expect(keys).toContain(key)
    }
  })

  it('两项待办仍留在 schema 里，保存快照不会因此缺项', () => {
    for (const key of BACKLOG_KEYS) expect(THEME_SETTING_KEYS).toContain(key)
  })

  it('每一项都写了说明，不留空白控件', () => {
    for (const field of THEME_FORM_FIELDS) {
      expect(field.help.length).toBeGreaterThan(0)
      if (field.kind === 'select') expect(field.options?.length).toBeGreaterThan(0)
      if (field.kind === 'number') {
        expect(typeof field.min).toBe('number')
        expect(typeof field.max).toBe('number')
      }
    }
  })

  it('主题模式保留 CFSM 的「跟随系统」，对应 preferred_theme 的 auto', () => {
    const themeMode = THEME_FORM_FIELDS.find((field) => field.key === 'themeMode')
    expect(themeMode?.options?.map((option) => option.value)).toEqual(['beijing', 'system', 'light', 'dark'])
    expect(themeMode?.note).toContain('auto')
  })

  it('依赖项在前置开关关闭时禁用', () => {
    const settings = cloneThemeSettings(DEFAULT_THEME_SETTINGS)
    const field = (key: string) => {
      const match = THEME_FORM_FIELDS.find((item) => item.key === key)
      if (!match) throw new Error(`missing field ${key}`)
      return match
    }

    expect(isFieldEnabled(field('alertTitle'), settings)).toBe(false)
    settings.alertEnabled = true
    expect(isFieldEnabled(field('alertTitle'), settings)).toBe(true)

    expect(isFieldEnabled(field('nodeCardSize'), settings)).toBe(true)
    settings.defaultViewMode = 'list'
    expect(isFieldEnabled(field('nodeCardSize'), settings)).toBe(false)

    expect(isFieldEnabled(field('diskPredictionThresholdDays'), settings)).toBe(false)
    settings.diskPredictionEnabled = true
    expect(isFieldEnabled(field('diskPredictionThresholdDays'), settings)).toBe(true)

    expect(isFieldEnabled(field('chartDashboardTemplate'), settings)).toBe(false)
    settings.chartDashboardPreset = '自定义'
    expect(isFieldEnabled(field('chartDashboardTemplate'), settings)).toBe(true)

    settings.hideEarth = true
    expect(isFieldEnabled(field('earthRenderer'), settings)).toBe(false)
    expect(isFieldEnabled(field('stopEarth'), settings)).toBe(false)
  })

  it('数据更新间隔说明写明 CFSM 的推送语义与下限', () => {
    const field = THEME_FORM_FIELDS.find((item) => item.key === 'dataUpdateInterval')
    expect(field?.note).toContain('WebSocket')
    expect(field?.note).toContain('5 秒')
  })
})
