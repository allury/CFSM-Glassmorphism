import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeSiteConfig } from '@/services/cfsm/adapters'
import { useAppStore } from '@/stores/app'
import { useServerDetailStore } from '@/stores/server-detail'

/*
 * 详情页的请求预算。
 *
 * CFSM 作者反馈冷启动打开详情页会发两次 `/api/config`。实测属实：一次来自应用引导，
 * 一次来自详情页按「节点归属的后端」再取一次。单后端站点上两次 URL 完全相同，
 * 第二次没有任何新信息，而 `/api/config` 在 CFSM 那边是要花 D1 查询的。
 *
 * 这里锁住两件事：单后端下不再重复请求，且多 apiBase 下仍然按来源单独取——
 * 后者是第二次请求存在的唯一理由，去重不能把它一起去掉。
 */

const BASE = 'https://status.example'
const OTHER = 'https://second.example'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 记录请求 URL 并返回各端点的最小合法载荷。 */
function stubNetwork(): string[] {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: unknown) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/api/config')) return jsonResponse({ site_title: 'demo', version: '2.8.5' })
    if (url.includes('/api/server?')) return jsonResponse({ id: 'node-1', name: 'Node 1' })
    if (url.includes('/api/history/all')) return jsonResponse([])
    return jsonResponse({})
  })
  // 详情页打开后会建立 WebSocket；node 环境下不连真实服务。
  vi.stubGlobal('WebSocket', class {
    static readonly OPEN = 1
    readyState = 0
    close(): void {}
    send(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
  })
  return calls
}

function configCalls(calls: readonly string[]): string[] {
  return calls.filter((url) => url.includes('/api/config'))
}

function historyCalls(calls: readonly string[]): string[] {
  return calls.filter((url) => url.includes('/api/history/all'))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detail page request budget', () => {
  it('reuses the loaded site config instead of asking /api/config a second time', async () => {
    const calls = stubNetwork()
    setActivePinia(createPinia())

    const app = useAppStore()
    app.apiBases = [BASE]
    app.applyConfig(normalizeSiteConfig({ site_title: 'demo', version: '2.8.5' }))

    const detail = useServerDetailStore()
    await detail.open('node-1', [BASE])

    expect(configCalls(calls)).toHaveLength(0)
    // 复用而不是跳过：详情页仍然拿得到站点配置。
    expect(detail.sourceConfig).toBe(app.config)
  })

  it('still fetches per source when the node belongs to another API base', async () => {
    const calls = stubNetwork()
    setActivePinia(createPinia())

    const app = useAppStore()
    app.apiBases = [BASE]
    app.applyConfig(normalizeSiteConfig({ site_title: 'demo', version: '2.8.5' }))

    const detail = useServerDetailStore()
    await detail.open('node-1', [BASE, OTHER], OTHER)

    expect(configCalls(calls)).toHaveLength(1)
    expect(configCalls(calls)[0]).toContain(OTHER)
    expect(detail.sourceConfig).not.toBe(app.config)
  })

  it('asks for history once, because one window carries both the load and ping series', async () => {
    const calls = stubNetwork()
    setActivePinia(createPinia())

    const app = useAppStore()
    app.apiBases = [BASE]
    app.applyConfig(normalizeSiteConfig({ site_title: 'demo', version: '2.8.5' }))

    const detail = useServerDetailStore()
    await detail.open('node-1', [BASE])

    expect(historyCalls(calls)).toHaveLength(1)
    expect(historyCalls(calls)[0]).toContain('hours=24')
    // 延迟区跟随负载图的窗口，读的是同一份历史。
    expect(detail.pingHistoryHours).toBe(24)
    expect(detail.pingHistory).toBe(detail.history)
  })

  it('fetches a second window only when the ping chart is moved off the load window', async () => {
    const calls = stubNetwork()
    setActivePinia(createPinia())

    const app = useAppStore()
    app.apiBases = [BASE]
    app.applyConfig(normalizeSiteConfig({ site_title: 'demo', version: '2.8.5' }))

    const detail = useServerDetailStore()
    await detail.open('node-1', [BASE])
    expect(historyCalls(calls)).toHaveLength(1)

    await detail.loadPingHistory(1)
    expect(historyCalls(calls)).toHaveLength(2)
    expect(historyCalls(calls)[1]).toContain('hours=1')
    expect(detail.pingHistoryHours).toBe(1)
    expect(detail.pingHistory).not.toBe(detail.history)

    // 调回负载图的窗口：重新复用，不再产生请求。
    await detail.loadPingHistory(24)
    expect(historyCalls(calls)).toHaveLength(2)
    expect(detail.pingHistory).toBe(detail.history)
  })

  it('asks /api/server once and does not walk the server list', async () => {
    const calls = stubNetwork()
    setActivePinia(createPinia())

    const app = useAppStore()
    app.apiBases = [BASE]
    app.applyConfig(normalizeSiteConfig({ site_title: 'demo', version: '2.8.5' }))

    const detail = useServerDetailStore()
    await detail.open('node-1', [BASE])

    expect(calls.filter((url) => url.includes('/api/server?'))).toHaveLength(1)
    // `/api/servers` 由详情页视图在冷启动时单独取，store 自己不碰它。
    expect(calls.filter((url) => /\/api\/servers(\?|$)/.test(url))).toHaveLength(0)
  })
})
