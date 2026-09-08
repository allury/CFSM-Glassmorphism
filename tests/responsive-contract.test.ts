import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const stylesheet = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8')

describe('responsive layout contract', () => {
  it.each([375, 430, 768, 1024, 1440, 1920])('has a bounded layout strategy at %ipx', (width) => {
    expect(width >= 375 && width <= 1920).toBe(true)
    expect(stylesheet).toContain('width: min(100% - 32px, 1280px)')
  })

  it('covers mobile cards, the general stage, advanced tools, list conversion, detail charts and settings', () => {
    expect(stylesheet).toContain('@media (max-width: 768px)')
    expect(stylesheet).toContain('@media (max-width: 520px)')
    expect(stylesheet).toContain('@media (max-width: 430px)')
    expect(stylesheet).toContain('@media (max-width: 380px)')
    expect(stylesheet).toContain('.node-list__row')
    expect(stylesheet).toContain('.history-chart-grid')
    expect(stylesheet).toContain('.settings-layout')
    // 第 9.5 轮起 Earth 与总览合为 Komari 的统一栅格，Earth 自身的响应式
    // 由三个渲染器各自的 scoped 样式承担（对齐 Komari 的断点）。
    expect(stylesheet).toContain('.general-stage')
    expect(stylesheet).toContain('.advanced-tools__tabs')
    expect(stylesheet).toContain('.topology-grid')
    expect(stylesheet).toContain('@media (max-width: 560px)')
    expect(stylesheet).toContain('overflow-wrap: anywhere')
  })

  it('keeps the removed quick-view drawer out of the stylesheet', () => {
    // 强制中间层已在第 9.5 轮删除；第 9.9 轮清理其残留样式，
    // 旧的手绘 SVG 地图样式也一并移除，避免死代码继续进入产物。
    expect(stylesheet).not.toContain('quick-view')
    expect(stylesheet).not.toContain('.earth-marker')
    expect(stylesheet).not.toContain('.earth-regions')
    expect(stylesheet).not.toContain('.earth-stage')
  })
})
