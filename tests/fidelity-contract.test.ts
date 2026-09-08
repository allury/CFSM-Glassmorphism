import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function exists(path: string): boolean {
  return existsSync(new URL(path, import.meta.url))
}

/**
 * 第 9.5 轮：正式版 1:1 高保真收敛。
 *
 * 这些契约锁定「向原 Komari Glassmorphism 对齐」的结果，防止后续再退回
 * CFSM 自创的中间层或 SVG 仿制渲染器。
 */
describe('Komari fidelity contracts', () => {
  it('sends node card and list clicks straight to the detail route', () => {
    const home = source('../src/views/HomeView.vue')
    const card = source('../src/components/dashboard/ServerCard.vue')
    const list = source('../src/components/dashboard/ServerList.vue')

    // 主点击路径直接进入详情，并保留 owning source，避免多 apiBase 串节点。
    expect(home).toContain('function openServer')
    expect(home).toContain('name: \'server-detail\'')
    expect(home).toContain('query: { source: server.sourceBase }')

    // 卡片与列表行的主点击都只发一个 open 事件，由 HomeView 直接导航。
    expect(card).toContain('@click="emit(\'open\')"')
    expect(list).toContain('@click="emit(\'open\', server)"')
  })

  it('keeps the forced quick-view intermediate layer removed', () => {
    const home = source('../src/views/HomeView.vue')

    expect(exists('../src/components/dashboard/ServerQuickView.vue')).toBe(false)
    expect(home).not.toContain('ServerQuickView')
    expect(home).not.toContain('viewServerDetails')
    // 不得再出现「先预览、再打开完整详情」的二次确认入口。
    expect(home).not.toContain('quick-view__detail-link')
  })

  it('stops independent card and list controls from triggering navigation', () => {
    const card = source('../src/components/dashboard/ServerCard.vue')
    const list = source('../src/components/dashboard/ServerList.vue')

    expect(card).toContain('@click.stop="emit(\'toggleFavorite\')"')
    expect(list).toContain('@click.stop="emit(\'toggleFavorite\', server.key)"')
  })

  it('dispatches the three Earth renderers as separate lazy implementations', () => {
    const dispatcher = source('../src/components/dashboard/EarthMap.vue')

    expect(dispatcher).toContain('defineAsyncComponent')
    expect(dispatcher).toContain('NodeEarthRealisticGlobe.vue')
    expect(dispatcher).toContain('NodeEarthCobeGlobe.vue')
    expect(dispatcher).toContain('NodeEarthTiledMap.vue')
    expect(dispatcher.match(/defineAsyncComponent\(/g)).toHaveLength(3)

    expect(exists('../src/components/dashboard/NodeEarthRealisticGlobe.vue')).toBe(true)
    expect(exists('../src/components/dashboard/NodeEarthCobeGlobe.vue')).toBe(true)
    expect(exists('../src/components/dashboard/NodeEarthTiledMap.vue')).toBe(true)
  })

  it('keeps the realistic renderer on globe.gl and three instead of an SVG imitation', () => {
    const realistic = source('../src/components/dashboard/NodeEarthRealisticGlobe.vue')

    expect(realistic).toContain('import(\'globe.gl\')')
    expect(realistic).toContain('import(\'three\')')
    expect(realistic).toContain('earth-blue-marble.jpg')
    expect(realistic).toContain('showAtmosphere(true)')
    // 不得退化成手绘 SVG 世界地图。
    expect(realistic).not.toContain('earth-continents')
    expect(realistic).not.toContain('earth-silhouette')
  })

  it('keeps the cobe renderer on the real cobe library instead of a CSS imitation', () => {
    const cobe = source('../src/components/dashboard/NodeEarthCobeGlobe.vue')

    expect(cobe).toContain('from \'cobe\'')
    expect(cobe).toContain('createGlobe(')
    expect(cobe).toContain('mapSamples')
    expect(cobe).not.toContain('earth-continents')
    expect(cobe).not.toContain('earth-silhouette')
  })

  it('keeps the tiled map a distinct renderer built on the real earth texture', () => {
    const tiled = source('../src/components/dashboard/NodeEarthTiledMap.vue')

    expect(tiled).toContain('earth-blue-marble.jpg')
    expect(tiled).toContain('earth-topology.png')
    expect(tiled).toContain('earth-water.png')
    // tiled 是独立渲染器，不是球体，也不复用 globe.gl / cobe。
    expect(tiled).not.toContain('globe.gl')
    expect(tiled).not.toContain('from \'cobe\'')
    // 移动端保留 Komari 的横向滚动行为。
    expect(tiled).toContain('earth-map-scroll')
    expect(tiled).toContain('overflow-x: auto')
  })

  it('locates nodes only from reliable CFSM region data', () => {
    const clusters = source('../src/composables/useServerGeoClusters.ts')

    expect(clusters).toContain('buildEarthPoints')
    // CFSM 不提供真实 IP/ASN/城市，绝不做外部 IP Geo 查询或坐标猜测。
    expect(clusters).not.toMatch(/\bfetch\s*\(/)
    expect(clusters).not.toContain('ipGeo')
    expect(clusters).not.toContain('lookupIp')
  })

  it('uses the CFSM default-skin flag assets instead of bundling its own', () => {
    const flags = source('../src/utils/flags.ts')

    // theme-develop.md：旗帜使用 /flags/<code>.svg，不要打包进主题。
    expect(flags).toContain('`/flags/${code.trim().toLowerCase()}.svg`')
  })

  it('keeps home browsing state across home -> detail -> home', () => {
    const home = source('../src/views/HomeView.vue')
    const viewStore = source('../src/stores/dashboard-view.ts')
    const router = source('../src/router/index.ts')

    // 搜索、分组、排序与快捷筛选放在会话级 store，返回首页时不重置。
    expect(viewStore).toContain('useDashboardViewStore')
    for (const key of ['query', 'selectedGroup', 'sort', 'activeQuickFilter']) {
      expect(viewStore).toContain(key)
    }
    expect(home).toContain('storeToRefs(viewState)')
    // 浏览器返回时恢复原滚动位置。
    expect(router).toContain('scrollBehavior')
    expect(router).toContain('savedPosition ?? { top: 0 }')
    // 这些是浏览状态，不得混入后端主题配置或本地覆盖，也不做任何持久化。
    expect(viewStore).not.toMatch(/localStorage\s*\./)
    expect(viewStore).not.toMatch(/sessionStorage\s*\./)
    expect(viewStore).not.toMatch(/\bfetch\s*\(/)
  })

  it('renders Earth and the overview cards inside one general stage like Komari', () => {
    const home = source('../src/views/HomeView.vue')
    const stylesheet = source('../src/styles/main.css')

    expect(home).toContain('class="general-stage"')
    expect(home).toContain('general-stage__earth')
    expect(home).toContain('general-stage__cards')
    // 球体在桌面端占右半、卡片占左半；tiled 改为卡片在上、地图在下。
    expect(stylesheet).toMatch(/\.general-stage--globe \.general-stage__earth\s*\{[^}]*grid-row: 1/s)
    expect(stylesheet).toMatch(/\.general-stage--tiled \.general-stage__earth\s*\{[^}]*grid-row: 2/s)
  })
})
