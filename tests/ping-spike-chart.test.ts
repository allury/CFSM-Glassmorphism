import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  pingChartOption,
  pingSpikeMasks,
  visibleSpikeCount,
  type PingChartContext,
  type PingTaskLine,
} from '@/domain/detail-chart-options'
import { buildChartRows, probeStats } from '@/domain/server-detail'
import type { HistoryPoint, ProbeTarget } from '@/types/cfsm'
import { getChartSeriesPalette, getPingChartThemeColors } from '@/utils/chart-palette'

/*
 * 延迟大图的四种开关组合（曲线平滑 × 隐藏尖峰）。
 *
 * 这里驱动的是真实的图表选项构建器，不是字符串断言：
 * - 遮蔽只落在绘图副本，数组长度、时间映射、未遮蔽的数值逐点不变；
 * - 平滑不参与检测，两种开启顺序得到同一张图；
 * - 纵轴不写死上下限，遮蔽后的数据里不再含尖峰值，范围随之收缩；
 * - 统计从原始数据算，四种组合下逐项相等；
 * - 按钮计数只数实际画出来的线；Tooltip 在被隐藏的时刻照实显示原值并标明「已隐藏」。
 */

const START = 1_700_000_000_000
const STEP = 60_000
const SPIKE_AT = 6

/** 电信约 200ms，第 6 个点冲到 1200；联通稳定在 600；移动带一个超时。 */
const CT = [198, 203, 200, 206, 197, 201, 1200, 199, 202, 200, 205, 198]
const CU = [602, 598, 611, 590, 603, 607, 596, 600, 612, 601, 599, 604]
const CM: Array<number | null> = [150, 152, 149, null, 151, 150, 148, 1150, 151, 149, 150, 152]

function point(index: number): HistoryPoint {
  return {
    timestamp: START + index * STEP,
    cpu: 10,
    gpus: [],
    memoryUsed: 1,
    memoryTotal: 2,
    swapUsed: null,
    swapTotal: null,
    diskUsed: 1,
    diskTotal: 2,
    networkInSpeed: 1,
    networkOutSpeed: 1,
    networkReceived: 1,
    networkTransmitted: 1,
    processes: 1,
    tcpConnections: 1,
    udpConnections: 1,
    load1: 0,
    load5: 0,
    load15: 0,
    temperature: null,
    latency: {
      ct: CT[index] ?? false,
      cu: CU[index] ?? false,
      cm: CM[index] === undefined ? false : CM[index] ?? null,
      bd: false,
      node_1: false,
      node_2: false,
      node_3: false,
      node_4: false,
    },
    packetLoss: { ct: 0, cu: 0, cm: 0, bd: false, node_1: false, node_2: false, node_3: false, node_4: false },
  }
}

const points = Array.from({ length: CT.length }, (_, index) => point(index))
const rows = buildChartRows(points)
const palette = getChartSeriesPalette(false)
const tasks: PingTaskLine[] = (['ct', 'cu', 'cm'] as ProbeTarget[]).map((target, index) => ({
  target,
  label: ['电信', '联通', '移动'][index] ?? target,
  color: palette[index] ?? '#FF6B6B',
}))

interface LooseSeries {
  name: string
  data: Array<number | null>
  smooth: number
  connectNulls: boolean
}

function base(overrides: Partial<PingChartContext> = {}): PingChartContext {
  return {
    rows,
    hours: 1,
    theme: getPingChartThemeColors(false),
    tasks,
    selected: tasks,
    smooth: false,
    accessible: false,
    spikeMasks: pingSpikeMasks(rows, tasks),
    ...overrides,
  }
}

function seriesOf(context: PingChartContext): LooseSeries[] {
  return pingChartOption(context).series as unknown as LooseSeries[]
}

const states = [
  { name: '平滑关 · 隐藏关', smooth: false, hideSpikes: false },
  { name: '平滑开 · 隐藏关', smooth: true, hideSpikes: false },
  { name: '平滑关 · 隐藏开', smooth: false, hideSpikes: true },
  { name: '平滑开 · 隐藏开', smooth: true, hideSpikes: true },
] as const

describe('遮蔽集合', () => {
  it('每条线独立：电信与移动各命中自己的孤立高点，稳定 600ms 的联通完整保留', () => {
    const masks = pingSpikeMasks(rows, tasks)
    const hidden = (target: ProbeTarget) => (masks.get(target) ?? []).flatMap((flag, index) => (flag ? [index] : []))
    expect(hidden('ct')).toEqual([SPIKE_AT])
    expect(hidden('cu')).toEqual([])
    // 移动的高点在第 7 格；第 3 格是超时，不计为隐藏，也不影响右侧的证据。
    expect(hidden('cm')).toEqual([7])
    for (const task of tasks) expect(masks.get(task.target)).toHaveLength(rows.length)
  })

  it('与曲线平滑无关：同一份原始行永远得到同一组点', () => {
    expect(pingSpikeMasks(rows, tasks)).toEqual(pingSpikeMasks(structuredClone(rows), tasks))
  })

  it('不修改原始行', () => {
    const snapshot = structuredClone(rows)
    pingSpikeMasks(rows, tasks)
    for (const state of states) seriesOf(base(state))
    expect(rows).toEqual(snapshot)
  })
})

describe('四种组合的绘图数组', () => {
  const raw = seriesOf(base())

  for (const state of states) {
    it(`${state.name}：长度、时间映射、connectNulls 与曲率`, () => {
      const option = pingChartOption(base(state))
      const series = option.series as unknown as LooseSeries[]
      expect(option.xAxis.data).toHaveLength(rows.length)
      for (const item of series) {
        expect(item.data).toHaveLength(rows.length)
        expect(item.connectNulls).toBe(false)
        expect(item.smooth).toBe(state.smooth ? 0.6 : 0.1)
      }
    })
  }

  it('隐藏关闭时与此前版本逐点相同（平滑开关不改数值）', () => {
    expect(seriesOf(base({ smooth: true })).map((item) => item.data)).toEqual(raw.map((item) => item.data))
    expect(seriesOf(base({ hideSpikes: false })).map((item) => item.data)).toEqual(raw.map((item) => item.data))
    // 与不传遮蔽参数的旧调用方式完全一致。
    expect(seriesOf(base({ spikeMasks: undefined })).map((item) => item.data)).toEqual(raw.map((item) => item.data))
  })

  it('隐藏开启时只把命中的格子换成 null，其余有效值逐点相等', () => {
    const hidden = seriesOf(base({ hideSpikes: true }))
    const masks = pingSpikeMasks(rows, tasks)
    hidden.forEach((item, seriesIndex) => {
      const task = tasks[seriesIndex]
      const original = raw[seriesIndex]
      expect(task && original).toBeTruthy()
      if (!task || !original) return
      item.data.forEach((value, index) => {
        if (masks.get(task.target)?.[index]) expect(value).toBeNull()
        else expect(value).toBe(original.data[index])
      })
    })
    // 原始超时仍是 null，没有被改写成别的值，也没有被当作隐藏点。
    expect(hidden[2]?.data[3]).toBeNull()
    expect(raw[2]?.data[3]).toBeNull()
  })

  it('两种开启顺序得到同一张图，反复开关后恢复完整', () => {
    const smoothFirst = pingChartOption(base({ smooth: true, hideSpikes: true }))
    const hideFirst = pingChartOption(base({ hideSpikes: true, smooth: true }))
    expect(JSON.stringify(smoothFirst.series)).toBe(JSON.stringify(hideFirst.series))
    for (let round = 0; round < 3; round += 1) {
      seriesOf(base({ hideSpikes: true }))
      expect(seriesOf(base({ hideSpikes: false })).map((item) => item.data)).toEqual(raw.map((item) => item.data))
    }
  })

  it('纵轴不写死上下限，遮蔽后的数据里不再有尖峰值，范围随可见数据收缩', () => {
    const on = pingChartOption(base({ hideSpikes: true }))
    const axis = on.yAxis as Record<string, unknown>
    expect(axis.min).toBeUndefined()
    expect(axis.max).toBeUndefined()
    expect(axis.type).toBe('value')
    const visibleMax = Math.max(...(on.series as unknown as LooseSeries[])
      .flatMap((item) => item.data.filter((value): value is number => value !== null)))
    const rawMax = Math.max(...seriesOf(base()).flatMap((item) => item.data.filter((value): value is number => value !== null)))
    expect(rawMax).toBe(1200)
    expect(visibleMax).toBe(612)
    // 所有线共用同一根纵轴，不各自缩放。
    expect(Array.isArray(on.yAxis)).toBe(false)
  })
})

describe('统计不受开关影响', () => {
  it('四种组合下任务卡统计逐项相等，且与原始数据一致', () => {
    const reference = tasks.map((task) => probeStats(points, task.target))
    for (const state of states) {
      seriesOf(base(state))
      expect(tasks.map((task) => probeStats(points, task.target)), state.name).toEqual(reference)
    }
    // 统计里的最大值仍是尖峰本身，没有被遮蔽影响。
    expect(reference[0]?.max).toBe(1200)
  })
})

describe('按钮计数', () => {
  const masks = pingSpikeMasks(rows, tasks)

  it('只数实际画出来的线：取消选中或图例关闭的线不计入', () => {
    expect(visibleSpikeCount(tasks, masks)).toBe(2)
    expect(visibleSpikeCount(tasks.filter((task) => task.target !== 'cm'), masks)).toBe(1)
    expect(visibleSpikeCount(tasks, masks, { 电信: false })).toBe(1)
    expect(visibleSpikeCount(tasks, masks, { 电信: true, 移动: true })).toBe(2)
    expect(visibleSpikeCount([], masks)).toBe(0)
  })

  it('没有命中时为 0；平滑与色觉模式不影响计数', () => {
    expect(visibleSpikeCount(tasks.filter((task) => task.target === 'cu'), masks)).toBe(0)
    // 计数只依赖遮蔽集合与可见线路，与绘图选项的其它开关无关。
    for (const state of states) {
      pingChartOption(base({ ...state, accessible: true }))
      expect(visibleSpikeCount(tasks, masks)).toBe(2)
    }
  })

  it('同一时刻不同线路分别计数', () => {
    const sameInstant = new Map<ProbeTarget, boolean[]>([
      ['ct', rows.map((_, index) => index === 4)],
      ['cu', rows.map((_, index) => index === 4)],
    ])
    expect(visibleSpikeCount(tasks, sameInstant)).toBe(2)
  })
})

describe('图例与 Tooltip', () => {
  it('图例状态显式传给图表', () => {
    const option = pingChartOption(base({ legendSelected: { 电信: false } }))
    expect((option.legend as { selected?: Record<string, boolean> }).selected).toEqual({ 电信: false })
    expect((pingChartOption(base()).legend as { selected?: unknown }).selected).toBeUndefined()
  })

  type Formatter = (params: unknown) => string
  const formatterOf = (context: PingChartContext) => (pingChartOption(context).tooltip as { formatter: Formatter }).formatter
  // 被遮蔽的点在副本里是 null，ECharts 交给 formatter 的就是 null。
  const paramsAt = (index: number, hidden: boolean) => [
    { seriesName: '电信', dataIndex: index, value: hidden ? null : CT[index] },
    { seriesName: '联通', dataIndex: index, value: CU[index] },
  ]

  it('隐藏开启时，被隐藏的时刻照实显示原值并标明「已隐藏」', () => {
    const html = formatterOf(base({ hideSpikes: true }))(paramsAt(SPIKE_AT, true))
    expect(html).toContain('1200 ms')
    expect(html).toContain('已隐藏')
    // 不能显示成 0：匹配完整的数值单元格，避免把 1200 里的 0 算进去。
    expect(html).not.toMatch(/>0 ms</)
    expect(html).toContain('596 ms')
  })

  it('隐藏关闭时普通显示原值，没有「已隐藏」标记', () => {
    const html = formatterOf(base())(paramsAt(SPIKE_AT, false))
    expect(html).toContain('1200 ms')
    expect(html).not.toContain('已隐藏')
  })

  it('图例关掉的线，即使在被隐藏的时刻也不出现', () => {
    const html = formatterOf(base({ hideSpikes: true, legendSelected: { 电信: false } }))(paramsAt(SPIKE_AT, true))
    expect(html).not.toContain('1200 ms')
    expect(html).not.toContain('已隐藏')
  })

  it('普通时刻不出现「已隐藏」', () => {
    const html = formatterOf(base({ hideSpikes: true }))(paramsAt(2, false))
    expect(html).not.toContain('已隐藏')
    expect(html).toContain('200 ms')
  })
})

describe('组件接线', () => {
  const source = readFileSync(new URL('../src/components/detail/PingChart.vue', import.meta.url), 'utf8')

  it('两个独立开关加一个共用说明入口，删除了只解释平滑的旧入口', () => {
    expect(source).toContain('曲线平滑')
    expect(source).toContain('隐藏尖峰')
    expect(source).toContain('aria-label="图表显示说明"')
    expect(source).not.toContain('SMOOTH_HINT')
    expect(source).not.toContain('AppTooltip')
    // 说明入口是真正的按钮，而不是 aria-hidden 的装饰图标。
    expect(source).not.toMatch(/class="ping-task__info" aria-hidden="true"/)
  })

  it('说明三段文字与任务书一致', () => {
    expect(source).toContain('只调整线条弯曲程度，不修改采样值。')
    expect(source).toContain('仅在图上隐藏识别出的孤立高值，隐藏处保留断口；关闭后恢复显示。')
    expect(source).toContain('先隐藏尖峰，再平滑剩余连续线段。原始数据和统计结果均不变。')
  })

  it('两个开关初始都关闭，且不写入任何持久化存储', () => {
    expect(source).toMatch(/const smooth = ref\(false\)/)
    expect(source).toMatch(/const hideSpikes = ref\(false\)/)
    expect(source).not.toMatch(/localStorage|theme\.set|setLocalSetting/)
  })

  it('统计仍从原始历史算，不经过遮蔽', () => {
    expect(source).toMatch(/stats: probeStats\(pingHistoryPoints\.value, entry\.target\)/)
  })
})
