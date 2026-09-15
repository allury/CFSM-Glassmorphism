import { readFileSync } from 'node:fs'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import AppHeader from '@/components/dashboard/AppHeader.vue'

/*
 * 顶栏的站点标记。
 *
 * 此前这里是一枚纯 CSS 的固定几何标记（翡翠圆环 + 蓝点），既不是站点自己的图标，
 * 也不随配色方案变化，而 Komari `Header.vue` 在同一位置放的是站点 Avatar：
 * `AvatarImage src="/favicon.ico"` 加站点名首字兜底。
 *
 * CFSM 把站点图标存在后台「网站图标」里并作为 `<link rel="icon">` 注入 index.html，
 * 值通常是 data: URI；`/api/config` 不返回这个字段（实测顶层与 theme_options 里都没有），
 * 所以只能从文档里读那一条 link。下面锁住三级回退：图标 → 首字 → 几何标记，
 * 任何一步都不会让这个位置空着。
 */

const props = {
  title: '养鸡场',
  version: '2.8.5',
  loading: false,
  adminUrl: null,
  themeMode: 'system' as const,
}

async function render(overrides: Record<string, unknown> = {}): Promise<string> {
  const html = await renderToString(createSSRApp(AppHeader, { ...props, ...overrides }))
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

const source = readFileSync(new URL('../src/components/dashboard/AppHeader.vue', import.meta.url), 'utf8')
const stylesheet = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8')

describe('header brand mark', () => {
  /* SSR 没有 document，favicon 取不到，正好覆盖第二级回退。 */
  it('falls back to the site initial when no icon is available', async () => {
    const html = await render()
    expect(html).toContain('<b class="brand__mark-initial">养</b>')
    expect(html).not.toContain('brand__mark-image')
  })

  it('falls back to the built-in mark when there is no title either', async () => {
    const html = await render({ title: '   ' })
    expect(html).toContain('brand__mark-dot')
    expect(html).not.toContain('brand__mark-initial')
  })

  it('reads the injected link tag rather than assuming /favicon.ico exists', () => {
    expect(source).toContain('link[rel~="icon"]')
    // 取不到注入的那条时才退到固定路径。
    expect(source).toContain("'/favicon.ico'")
    // 服务端渲染没有 document，必须先挡一道。
    expect(source).toContain("typeof document === 'undefined'")
  })

  it('drops back to the initial when the icon fails to load', () => {
    expect(source).toMatch(/@error="faviconFailed = true"/)
    expect(source).toContain('faviconFailed.value ? \'\' : faviconSource.value')
  })

  /*
   * 关键回归：环与点此前挂在 `.brand__mark::before` 与 `.brand__mark span` 上，
   * 那样写的话站点图标显示时它们仍会画在底下。现在必须只作用于兜底元素。
   */
  it('never paints the geometric mark behind the site icon', () => {
    expect(stylesheet).not.toContain('.brand__mark::before')
    expect(stylesheet).not.toMatch(/\.brand__mark span \{/)
    expect(stylesheet).toContain('.brand__mark-dot')
  })

  it('clips the icon to the existing round container', () => {
    const start = stylesheet.indexOf('.brand__mark-image {')
    expect(start).toBeGreaterThan(-1)
    const block = stylesheet.slice(start, stylesheet.indexOf('}', start))
    expect(block).toContain('object-fit: cover')
    const markStart = stylesheet.indexOf('.brand__mark {')
    const markBlock = stylesheet.slice(markStart, stylesheet.indexOf('}', markStart))
    expect(markBlock).toContain('overflow: hidden')
    expect(markBlock).toContain('border-radius: 50%')
  })
})
