import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { beforeEach, describe, expect, it } from 'vitest'
import DynamicBackground from '@/components/dashboard/DynamicBackground.vue'
import { useThemeSettingsStore } from '@/stores/theme-settings'

async function renderBackground(): Promise<string> {
  const pinia = getActivePinia()
  if (!pinia) throw new Error('Missing test Pinia')
  return renderToString(createSSRApp(DynamicBackground).use(pinia))
}

describe('cold-start background request gate', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('does not mount or request the default image before site config is settled', async () => {
    const html = await renderBackground()
    expect(html).toContain('class="dynamic-background"')
    expect(html).not.toContain('dynamic-background__default')
    expect(html).not.toContain('default-background-v2')
    expect(html).not.toContain('dynamic-background__media')
  })

  it('goes straight to custom background after config hydration', async () => {
    const theme = useThemeSettingsStore()
    theme.hydrateBackend({ backgroundEnabled: true, backgroundType: 'image', lightBackgroundUrl: '/custom.jpg' }, 'auto', true)
    const html = await renderBackground()
    expect(html).toContain('dynamic-background--custom')
    expect(html).toContain('src="/custom.jpg"')
    expect(html).not.toContain('default-background-v2')
  })

  it('shows the default only after a confirmed config without custom background', async () => {
    const theme = useThemeSettingsStore()
    theme.hydrateBackend({ backgroundEnabled: false }, 'auto', true)
    const html = await renderBackground()
    expect(html).toContain('dynamic-background__default')
  })

  it('falls back to default after a definite config failure', async () => {
    const theme = useThemeSettingsStore()
    theme.resolveConfigFailure()
    const html = await renderBackground()
    expect(html).toContain('dynamic-background__default')
  })
})
