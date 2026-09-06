import { describe, expect, it } from 'vitest'
import {
  fetchAllServerSources,
  fetchServers,
  fetchSiteConfig,
} from '@/services/cfsm/api'

describe('CFSM REST services', () => {
  it('loads and normalizes /api/config from the selected base', async () => {
    let requested = ''
    const fetcher: typeof fetch = async (input) => {
      requested = String(input)
      return new Response(JSON.stringify({
        site_title: 'Real status',
        version: '2.8.5',
        preferred_theme: 'light',
      }), { status: 200 })
    }

    const config = await fetchSiteConfig('https://status.example', { fetcher })

    expect(requested).toBe('https://status.example/api/config')
    expect(config.siteTitle).toBe('Real status')
    expect(config.version).toBe('2.8.5')
  })

  it('loads /api/servers and preserves source ownership', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      servers: [{ id: 'real-node', name: 'Real node', cpu: 0 }],
      stats: { total: 1 },
    }), { status: 200 })

    const result = await fetchServers('https://a.example', { fetcher }, 1)

    expect(result.servers).toHaveLength(1)
    expect(result.servers[0]?.cpu).toBe(0)
    expect(result.servers[0]?.source).toEqual({
      base: 'https://a.example',
      label: 'a.example #2',
    })
  })

  it('keeps successful API bases when another source returns 503', async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      if (url.startsWith('https://b.example')) {
        return new Response('{"message":"temporarilyUnavailable"}', { status: 503 })
      }
      return new Response('{"servers":[{"id":"a-node"}],"stats":{}}', { status: 200 })
    }

    const result = await fetchAllServerSources(
      ['https://a.example', 'https://b.example'],
      { fetcher },
    )

    expect(result.collections).toHaveLength(1)
    expect(result.collections[0]?.servers[0]?.id).toBe('a-node')
    expect(result.failures).toEqual([{
      source: { base: 'https://b.example', label: 'b.example #2' },
      message: 'temporarilyUnavailable',
      status: 503,
      code: 'temporarilyUnavailable',
    }])
  })

  it('accepts a truthful zero-node response', async () => {
    const fetcher: typeof fetch = async () => new Response(
      '{"servers":[],"stats":{"total":0}}',
      { status: 200 },
    )

    const result = await fetchServers('https://status.example', { fetcher })

    expect(result.servers).toEqual([])
    expect(result.stats).toEqual({ total: 0 })
  })
})
