import { DEFAULT_PROBE_LABELS, PROBE_TARGETS } from '@/constants/probes'
import type {
  CfsmServer,
  HistoryPoint,
  ProbeLabels,
  ProbeTarget,
  ProbeValue,
} from '@/types/cfsm'
import { getChartSeriesPalette, getLoadChartPalette, type LoadChartPalette } from '@/utils/chart-palette'
import { normalizeTimestampMilliseconds } from '@/utils/format'

export type DetailMetricKind =
  | 'bytes'
  | 'count'
  | 'load'
  | 'milliseconds'
  | 'percent'
  | 'speed'

export interface DetailChartPoint {
  timestamp: number
  value: ProbeValue
}

/**
 * 面积填充的两个渐变端点，对应上游 `LoadChartPalette` 的
 * `*AreaStrong`（顶部)与 `*AreaFaint`（底部）。
 */
export interface DetailChartArea {
  strong: string
  faint: string
}

export interface DetailChartSeries {
  key: string
  label: string
  color: string
  /** 上游内联图是 1.5 + `cap: 'round'`；`MetricSeriesChartCard` 那一族是 1.6 且无 cap。 */
  lineWidth: number
  roundCap: boolean
  /** 仅上游确有 `areaStyle` 的序列才带填充：CPU、RAM、磁盘已用、进程数。 */
  area?: DetailChartArea
  points: DetailChartPoint[]
}

export interface DetailChartModel {
  key: string
  title: string
  subtitle: string
  kind: DetailMetricKind
  percentScale?: boolean
  probeStates?: boolean
  series: DetailChartSeries[]
}

/*
 * 序列颜色来自 `utils/chart-palette.ts`（移植自上游 `chartPalette.ts`），
 * 由调用方按当前色觉模式传入。这里此前写的是 `var(--emerald)` 这类 CSS 变量，
 * 而图表走 CanvasRenderer——canvas 不解析 CSS 变量，整组折线因此被画成纯黑。
 * 颜色在这一层就定成具体值，折线、图例、tooltip 色点与底部摘要才会始终一致。
 */
const DEFAULT_PALETTE = getChartSeriesPalette(false)
const DEFAULT_LOAD_PALETTE = getLoadChartPalette(false)

function paletteColor(palette: readonly string[], index: number): string {
  return palette[index % palette.length] ?? DEFAULT_PALETTE[0] as string
}

function sortedPoints(points: readonly HistoryPoint[]): HistoryPoint[] {
  return [...points].sort((left, right) => left.timestamp - right.timestamp)
}

function timestamp(value: number): number | null {
  return normalizeTimestampMilliseconds(value)
}

function percentage(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0 || used < 0) return null
  return Math.min(Math.max((used / total) * 100, 0), 100)
}

interface SeriesStyle {
  color: string
  lineWidth?: number
  roundCap?: boolean
  area?: DetailChartArea
}

/** 上游内联图（LoadChart）的线形：1.5px + 圆线帽。 */
function inlineStyle(color: string, area?: DetailChartArea): SeriesStyle {
  return { color, lineWidth: 1.5, roundCap: true, area }
}

/** 上游 `MetricSeriesChartCard` 的线形：1.6px，无 cap，无填充。 */
function cardStyle(color: string): SeriesStyle {
  return { color, lineWidth: 1.6, roundCap: false }
}

function series(
  key: string,
  label: string,
  style: SeriesStyle,
  points: readonly HistoryPoint[],
  value: (point: HistoryPoint) => ProbeValue,
): DetailChartSeries | null {
  const mapped = points.flatMap((point) => {
    const pointTimestamp = timestamp(point.timestamp)
    return pointTimestamp === null ? [] : [{ timestamp: pointTimestamp, value: value(point) }]
  })
  if (!mapped.some((point) => typeof point.value === 'number')) return null
  return {
    key,
    label,
    color: style.color,
    lineWidth: style.lineWidth ?? 1.6,
    roundCap: style.roundCap ?? false,
    ...(style.area ? { area: style.area } : {}),
    points: mapped,
  }
}

function chart(
  model: Omit<DetailChartModel, 'series'>,
  candidates: Array<DetailChartSeries | null>,
): DetailChartModel | null {
  const available = candidates.filter((item): item is DetailChartSeries => item !== null)
  return available.length > 0 ? { ...model, series: available } : null
}

/*
 * 逐序列对照上游，而不是「都取自同一个调色板」就算对齐。
 * 上游详情页的图表分两条路径，配色来源与线形都不同：
 *
 * - `LoadChart.vue` 内联的 `VChart`（CPU、内存、磁盘、网络、GPU、连接数、进程）：
 *   用 `getLoadChartPalette()` 的**角色名**取色，线宽 1.5 + `cap: 'round'`。
 *   其中只有 CPU、RAM、磁盘已用、进程数四条带 `areaStyle` 渐变，
 *   **网络图两条线都没有填充**——第 15 轮把内联图一概写成「带渐变填充」是错的。
 * - `MetricSeriesChartCard`（累计流量、Ping、丢包）：用 `getChartSeriesPalette()`
 *   按序号取色，线宽 1.6、无 cap、无填充。
 *
 * 语义口径保持本主题既有选择（内存/磁盘按百分比、负载单独成图），不借样式修复改口径。
 */
export function buildMetricHistoryCharts(
  points: readonly HistoryPoint[],
  load: LoadChartPalette = DEFAULT_LOAD_PALETTE,
): DetailChartModel[] {
  const rows = sortedPoints(points)
  const primaryArea = { strong: load.primaryAreaStrong, faint: load.primaryAreaFaint }
  const tertiaryArea = { strong: load.tertiaryAreaStrong, faint: load.tertiaryAreaFaint }
  const charts = [
    chart({ key: 'cpu', title: 'CPU', subtitle: '处理器使用率', kind: 'percent', percentScale: true }, [
      // 上游 CPU 图第一条：primary + 渐变填充。
      series('cpu', 'CPU', inlineStyle(load.primary, primaryArea), rows, (point) => point.cpu),
    ]),
    /*
     * 上游把「负载」作为 CPU 图的第二根轴（单条 secondary，无填充）。
     * 本主题把 1 / 5 / 15 分钟单独成图，属于已验收的结构差异：
     * 1 min 沿用上游负载线的 secondary，5 / 15 min 取角色板里未被占用的两个色。
     */
    chart({ key: 'load', title: '系统负载', subtitle: '1 / 5 / 15 分钟', kind: 'load' }, [
      series('load-1', '1 min', inlineStyle(load.secondary), rows, (point) => point.load1),
      series('load-5', '5 min', inlineStyle(load.quinary), rows, (point) => point.load5),
      series('load-15', '15 min', inlineStyle(load.quaternary), rows, (point) => point.load15),
    ]),
    chart({ key: 'memory', title: '内存与交换分区', subtitle: '真实使用比例', kind: 'percent', percentScale: true }, [
      // 上游内存图：RAM = primary + 渐变，Swap = secondary 无填充。
      series('ram', 'RAM', inlineStyle(load.primary, primaryArea), rows, (point) => percentage(point.memoryUsed, point.memoryTotal)),
      series('swap', 'Swap', inlineStyle(load.secondary), rows, (point) => percentage(point.swapUsed, point.swapTotal)),
    ]),
    chart({ key: 'disk', title: '磁盘容量', subtitle: '真实使用比例', kind: 'percent', percentScale: true }, [
      // 上游磁盘图：磁盘已用 = tertiary + 渐变。
      series('disk', 'Disk', inlineStyle(load.tertiary, tertiaryArea), rows, (point) => percentage(point.diskUsed, point.diskTotal)),
    ]),
    chart({ key: 'network-speed', title: '实时网络', subtitle: '上下行速率', kind: 'speed' }, [
      // 上游网络图：下载 = quinary、上传 = quaternary，两条都**没有** areaStyle。
      series('network-in', '下载', inlineStyle(load.quinary), rows, (point) => point.networkInSpeed),
      series('network-out', '上传', inlineStyle(load.quaternary), rows, (point) => point.networkOutSpeed),
    ]),
    chart({ key: 'traffic', title: '累计流量', subtitle: '接收与发送', kind: 'bytes' }, [
      // 上游 `trafficChartSeries`：累计下载 = quinary、累计上传 = quaternary，走卡片线形。
      series('network-rx', '接收', cardStyle(load.quinary), rows, (point) => point.networkReceived),
      series('network-tx', '发送', cardStyle(load.quaternary), rows, (point) => point.networkTransmitted),
    ]),
    /*
     * 磁盘 IO 是 CFSM 独有图，上游没有对应组件。沿用同一套公共视觉语言：
     * 卡片线形 + 角色板里与读写语义不冲突的两个色，不虚构上游对应关系。
     */
    chart({ key: 'disk-io', title: '磁盘 IO', subtitle: '真实读写吞吐', kind: 'speed' }, [
      series('disk-read', '读取', cardStyle(load.tertiary), rows, (point) => point.diskIo?.readBps ?? null),
      series('disk-write', '写入', cardStyle(load.quaternary), rows, (point) => point.diskIo?.writeBps ?? null),
    ]),
  ]

  const gpuIds = new Map<string, string>()
  for (const point of rows) {
    for (const gpu of point.gpus) gpuIds.set(gpu.id, gpu.name)
  }
  // 上游 GPU 图：使用率 = senary，第二条（显存）= quaternary。本主题按设备拆条，首条沿用 senary。
  const gpuColors = [load.senary, load.quaternary, load.quinary, load.tertiary]
  const gpuChart = chart(
    { key: 'gpu', title: 'GPU', subtitle: '加速器使用率', kind: 'percent', percentScale: true },
    [...gpuIds.entries()].map(([id, name], index) => series(
      `gpu-${id}`,
      name,
      inlineStyle(gpuColors[index % gpuColors.length] as string),
      rows,
      (point) => point.gpus.find((gpu) => gpu.id === id)?.utilization ?? null,
    )),
  )
  if (gpuChart) charts.push(gpuChart)

  return charts.filter((item): item is DetailChartModel => item !== null)
}

export function buildProbeHistoryCharts(
  points: readonly HistoryPoint[],
  labels: ProbeLabels = DEFAULT_PROBE_LABELS,
  palette: readonly string[] = DEFAULT_PALETTE,
): DetailChartModel[] {
  const rows = sortedPoints(points)
  const ping = chart(
    {
      key: 'ping',
      title: 'Ping 历史',
      subtitle: '缺失断线，超时保留为空点',
      kind: 'milliseconds',
      probeStates: true,
    },
    PROBE_TARGETS.map((target, index) => series(
      `ping-${target}`,
      labels[target],
      cardStyle(paletteColor(palette, index)),
      rows,
      (point) => point.latency[target],
    )),
  )
  const loss = chart(
    {
      key: 'loss',
      title: '丢包历史',
      subtitle: '0% 是有效值，不与缺失混淆',
      kind: 'percent',
      percentScale: true,
      probeStates: true,
    },
    PROBE_TARGETS.map((target, index) => series(
      `loss-${target}`,
      labels[target],
      cardStyle(paletteColor(palette, index)),
      rows,
      (point) => point.packetLoss[target],
    )),
  )
  return [ping, loss].filter((item): item is DetailChartModel => item !== null)
}

export function activeProbeTargets(
  server: CfsmServer,
  points: readonly HistoryPoint[],
): ProbeTarget[] {
  return PROBE_TARGETS.filter((target) => (
    server.latency[target] !== false
    || server.packetLoss[target] !== false
    || points.some((point) => (
      point.latency[target] !== false || point.packetLoss[target] !== false
    ))
  ))
}
