import { DEFAULT_PROBE_LABELS, PROBE_TARGETS } from '@/constants/probes'
import type {
  CfsmServer,
  HistoryPoint,
  ProbeLabels,
  ProbeTarget,
  ProbeValue,
} from '@/types/cfsm'
import { getChartSeriesPalette } from '@/utils/chart-palette'
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

export interface DetailChartSeries {
  key: string
  label: string
  color: string
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

function series(
  key: string,
  label: string,
  color: string,
  points: readonly HistoryPoint[],
  value: (point: HistoryPoint) => ProbeValue,
): DetailChartSeries | null {
  const mapped = points.flatMap((point) => {
    const pointTimestamp = timestamp(point.timestamp)
    return pointTimestamp === null ? [] : [{ timestamp: pointTimestamp, value: value(point) }]
  })
  return mapped.some((point) => typeof point.value === 'number')
    ? { key, label, color, points: mapped }
    : null
}

function chart(
  model: Omit<DetailChartModel, 'series'>,
  candidates: Array<DetailChartSeries | null>,
): DetailChartModel | null {
  const available = candidates.filter((item): item is DetailChartSeries => item !== null)
  return available.length > 0 ? { ...model, series: available } : null
}

export function buildMetricHistoryCharts(
  points: readonly HistoryPoint[],
  palette: readonly string[] = DEFAULT_PALETTE,
): DetailChartModel[] {
  const rows = sortedPoints(points)
  const charts = [
    chart({ key: 'cpu', title: 'CPU', subtitle: '处理器使用率', kind: 'percent', percentScale: true }, [
      series('cpu', 'CPU', paletteColor(palette, 0), rows, (point) => point.cpu),
    ]),
    chart({ key: 'load', title: '系统负载', subtitle: '1 / 5 / 15 分钟', kind: 'load' }, [
      series('load-1', '1 min', paletteColor(palette, 0), rows, (point) => point.load1),
      series('load-5', '5 min', paletteColor(palette, 1), rows, (point) => point.load5),
      series('load-15', '15 min', paletteColor(palette, 3), rows, (point) => point.load15),
    ]),
    chart({ key: 'memory', title: '内存与交换分区', subtitle: '真实使用比例', kind: 'percent', percentScale: true }, [
      series('ram', 'RAM', paletteColor(palette, 1), rows, (point) => percentage(point.memoryUsed, point.memoryTotal)),
      series('swap', 'Swap', paletteColor(palette, 3), rows, (point) => percentage(point.swapUsed, point.swapTotal)),
    ]),
    chart({ key: 'disk', title: '磁盘容量', subtitle: '真实使用比例', kind: 'percent', percentScale: true }, [
      series('disk', 'Disk', paletteColor(palette, 2), rows, (point) => percentage(point.diskUsed, point.diskTotal)),
    ]),
    chart({ key: 'network-speed', title: '实时网络', subtitle: '上下行速率', kind: 'speed' }, [
      series('network-in', '下载', paletteColor(palette, 1), rows, (point) => point.networkInSpeed),
      series('network-out', '上传', paletteColor(palette, 3), rows, (point) => point.networkOutSpeed),
    ]),
    chart({ key: 'traffic', title: '累计流量', subtitle: '接收与发送', kind: 'bytes' }, [
      series('network-rx', '接收', paletteColor(palette, 0), rows, (point) => point.networkReceived),
      series('network-tx', '发送', paletteColor(palette, 2), rows, (point) => point.networkTransmitted),
    ]),
    chart({ key: 'disk-io', title: '磁盘 IO', subtitle: '真实读写吞吐', kind: 'speed' }, [
      series('disk-read', '读取', paletteColor(palette, 0), rows, (point) => point.diskIo?.readBps ?? null),
      series('disk-write', '写入', paletteColor(palette, 2), rows, (point) => point.diskIo?.writeBps ?? null),
    ]),
  ]

  const gpuIds = new Map<string, string>()
  for (const point of rows) {
    for (const gpu of point.gpus) gpuIds.set(gpu.id, gpu.name)
  }
  const gpuChart = chart(
    { key: 'gpu', title: 'GPU', subtitle: '加速器使用率', kind: 'percent', percentScale: true },
    [...gpuIds.entries()].map(([id, name], index) => series(
      `gpu-${id}`,
      name,
      paletteColor(palette, index),
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
      paletteColor(palette, index),
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
      paletteColor(palette, index),
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
