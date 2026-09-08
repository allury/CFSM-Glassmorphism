import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('release performance contracts', () => {
  it('keeps network orchestration out of views and per-node components', () => {
    const presentationSources = [
      '../src/views/HomeView.vue',
      '../src/components/dashboard/ServerCard.vue',
      '../src/components/dashboard/ServerList.vue',
      '../src/components/dashboard/EarthMap.vue',
      '../src/components/dashboard/AdvancedTools.vue',
    ].map(source).join('\n')

    expect(presentationSources).not.toMatch(/\bfetch\s*\(/)
    expect(presentationSources).not.toMatch(/\bsetInterval\s*\(/)
    expect(presentationSources).not.toMatch(/\bsetTimeout\s*\(/)
    expect(source('../src/views/HomeView.vue')).not.toContain('fetchHistory')
  })

  it('preserves batch rendering, dense lazy paint and lazy route boundaries', () => {
    const home = source('../src/views/HomeView.vue')
    const list = source('../src/components/dashboard/ServerList.vue')
    const stylesheet = source('../src/styles/main.css')
    const router = source('../src/router/index.ts')

    expect(home).toContain('glassServerMapper.map')
    expect(home).toContain('NODE_ITEM_DELAY_STYLES')
    expect(list).toContain('v-memo=')
    expect(stylesheet).toMatch(/\.server-grid--dense \.server-card\s*\{[^}]*content-visibility: auto/s)
    expect(router.match(/component: \(\) => import\(/g)).toHaveLength(3)
  })

  it('keeps the runtime dependency surface minimal and CFSM-specific', () => {
    const packageJson = JSON.parse(source('../package.json')) as {
      dependencies?: Record<string, string>
    }

    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual([
      'pinia',
      'vue',
      'vue-router',
    ])
  })
})
