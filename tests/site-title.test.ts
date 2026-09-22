import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { detailDocumentTitle, resolveSiteTitle } from '@/domain/site-title'

const detailView = readFileSync(new URL('../src/views/ServerDetailView.vue', import.meta.url), 'utf8')
const homeView = readFileSync(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')

describe('site title resolution', () => {
  it('keeps an unresolved title pending instead of inventing a default name', () => {
    expect(resolveSiteTitle(null, true)).toEqual({ state: 'pending', title: null })
  })

  it('uses a real title immediately and only falls back after resolution', () => {
    expect(resolveSiteTitle('  养鸡场  ', true)).toEqual({ state: 'ready', title: '养鸡场' })
    expect(resolveSiteTitle(null, false)).toEqual({ state: 'fallback', title: 'CF Server Monitor' })
  })

  it('writes only the server name until its owning source title is known', () => {
    const pending = resolveSiteTitle(null, true)
    expect(detailDocumentTitle(null, pending)).toBeNull()
    expect(detailDocumentTitle('Node B', pending)).toBe('Node B')
    expect(detailDocumentTitle('Node B', resolveSiteTitle('Source B', false))).toBe('Node B · Source B')
  })

  it('clears the previous source title while the next source and server are unresolved', () => {
    expect(detailView).toContain("document.title = title ?? ''")
    expect(detailView).not.toContain('if (title) document.title = title')
  })

  it('does not put a fake pending title into exported advanced-tool snapshots', () => {
    expect(homeView).toContain(':site-title="siteTitle ?? \'\'"')
    expect(homeView).not.toContain(':site-title="siteTitle ?? \'CF Server Monitor\'"')
  })
})
