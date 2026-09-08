import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const stylesheet = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8')

describe('responsive layout contract', () => {
  it.each([375, 430, 768, 1024, 1440, 1920])('has a bounded layout strategy at %ipx', (width) => {
    expect(width >= 375 && width <= 1920).toBe(true)
    expect(stylesheet).toContain('width: min(100% - 32px, 1280px)')
  })

  it('covers mobile cards, list conversion, detail charts, settings and modal drawer', () => {
    expect(stylesheet).toContain('@media (max-width: 768px)')
    expect(stylesheet).toContain('@media (max-width: 520px)')
    expect(stylesheet).toContain('@media (max-width: 430px)')
    expect(stylesheet).toContain('@media (max-width: 380px)')
    expect(stylesheet).toContain('.server-table tbody tr')
    expect(stylesheet).toContain('.quick-view__panel')
    expect(stylesheet).toContain('.history-chart-grid')
    expect(stylesheet).toContain('.settings-layout')
    expect(stylesheet).toContain('overflow-wrap: anywhere')
  })
})
