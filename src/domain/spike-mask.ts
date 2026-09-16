/*
 * 延迟大图「隐藏尖峰」的检测。
 *
 * 这不是异常证明：被命中的点仍是节点真实上报的数值，只是在**绘图副本**里被遮蔽，
 * 让常态区间在纵轴上舒展开。原始数据、统计值、首页口径一概不经过这里。
 *
 * 首版只处理一种形态——**两侧都有充分证据的单个孤立高点**。连续多个高点、持续高延迟、
 * 阶跃抬升、缓慢爬升一律保留：宁可让一个尖峰留在图上，也不能把一段真实故障画成平稳。
 *
 * 规则逐条：
 * 1. 按线路独立判断，调用方每条线单独调用；不同线路之间没有公共阈值。
 * 2. 从候选点向左、向右各取最多 `neighbors` 个有效样本作为邻域。遇到没有数值的格子
 *    （超时、未配置、缺列、离线缺口标记）立即停止，时间差超过「中位采样间隔 × gapFactor」
 *    也立即停止——不跨缺口借证据，也不拿固定索引跨度冒充固定时间窗口。
 * 3. 任一侧有效邻居少于 `minPerSide` 个，证据不足，保留。序列首尾因此天然保留。
 * 4. 以两侧邻居合并后的中位数为基线，MAD 估计噪声；噪声有下限，避免完全平稳的线路
 *    （MAD 为 0）因为一两毫秒抖动就被判高。
 * 5. 候选点要**同时**满足三项才算「高」：比基线高出至少 `minRiseMs` 毫秒；
 *    至少是基线的 `1 + minRiseRatio` 倍；高出量至少是噪声的 `madScale` 倍。
 * 6. 紧邻的左右两个样本本身不能也「高」——相邻多个高点属于平台，不隐藏。
 * 7. 左右两侧各自的中位数必须相近，否则是阶跃或爬升，不隐藏。
 * 8. 兜底：若一条原本有数据的线会被全部遮蔽，整条线回退为完整显示。
 *
 * 阈值集中在 `SPIKE_PARAMS`，不是从截图里猜的；固定样本见 `tests/spike-mask.test.ts`。
 */

export interface SpikeSample {
  /** 毫秒时间戳。 */
  timestamp: number
  /** 有效数值；null 表示这一格没有可用数值（超时、未配置、缺列或离线缺口）。 */
  value: number | null
}

export interface SpikeParams {
  /** 每侧最多取几个有效邻居作为基线样本。 */
  neighbors: number
  /** 每侧至少要有几个有效邻居，才允许下结论。 */
  minPerSide: number
  /** 相邻有效样本的时间差超过「中位采样间隔 × 该倍数」即视为断开。 */
  gapFactor: number
  /** 高出基线的绝对下限（毫秒）。 */
  minRiseMs: number
  /** 高出基线的相对下限：数值 ≥ 基线 × (1 + minRiseRatio)。 */
  minRiseRatio: number
  /** 稳健阈值：高出量 ≥ madScale × 噪声。 */
  madScale: number
  /** 噪声下限（毫秒）。 */
  noiseFloorMs: number
  /** 噪声下限相对基线的比例。 */
  noiseFloorRatio: number
  /** 左右两侧中位数允许的差距：max(minRiseMs, 基线) × 该比例。 */
  sideAgreement: number
}

export const SPIKE_PARAMS: Readonly<SpikeParams> = Object.freeze({
  neighbors: 4,
  minPerSide: 2,
  gapFactor: 2,
  minRiseMs: 100,
  minRiseRatio: 1,
  madScale: 6,
  noiseFloorMs: 2,
  noiseFloorRatio: 0.05,
  sideAgreement: 0.5,
})

/** MAD 换算为正态分布下的标准差估计。 */
const MAD_TO_SIGMA = 1.4826

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  if (sorted.length % 2 === 1) return upper
  return ((sorted[middle - 1] ?? upper) + upper) / 2
}

function isNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

/**
 * 返回与输入等长的布尔数组：true 表示这一格应在绘图时被遮蔽。
 * 输入不会被修改；没有数值的格子永远是 false。
 */
export function detectIsolatedSpikes(
  samples: readonly SpikeSample[],
  params: Readonly<SpikeParams> = SPIKE_PARAMS,
): boolean[] {
  const mask = samples.map(() => false)
  const valid = samples.flatMap((sample, index) => (
    isNumber(sample.value) ? [{ index, timestamp: sample.timestamp, value: sample.value }] : []
  ))
  if (valid.length < params.minPerSide * 2 + 1) return mask

  const deltas: number[] = []
  for (let position = 1; position < valid.length; position += 1) {
    const current = valid[position]
    const previous = valid[position - 1]
    if (!current || !previous) continue
    const delta = current.timestamp - previous.timestamp
    if (Number.isFinite(delta) && delta > 0) deltas.push(delta)
  }
  const maxStep = deltas.length > 0 ? median(deltas) * params.gapFactor : Number.POSITIVE_INFINITY

  function side(from: number, origin: number, direction: -1 | 1): number[] {
    const collected: number[] = []
    let previous = origin
    for (let index = from + direction; index >= 0 && index < samples.length; index += direction) {
      if (collected.length >= params.neighbors) break
      const sample = samples[index]
      if (!sample || !isNumber(sample.value)) break
      if (Math.abs(sample.timestamp - previous) > maxStep) break
      collected.push(sample.value)
      previous = sample.timestamp
    }
    return collected
  }

  for (const candidate of valid) {
    const left = side(candidate.index, candidate.timestamp, -1)
    const right = side(candidate.index, candidate.timestamp, 1)
    const nearLeft = left[0]
    const nearRight = right[0]
    if (left.length < params.minPerSide || right.length < params.minPerSide) continue
    if (nearLeft === undefined || nearRight === undefined) continue

    const pool = [...left, ...right]
    const baseline = median(pool)
    const mad = median(pool.map((item) => Math.abs(item - baseline)))
    const noise = Math.max(MAD_TO_SIGMA * mad, params.noiseFloorMs, baseline * params.noiseFloorRatio)
    const elevated = (value: number): boolean => (
      value - baseline >= params.minRiseMs
      && value >= baseline * (1 + params.minRiseRatio)
      && value - baseline >= params.madScale * noise
    )

    if (!elevated(candidate.value)) continue
    // 紧邻两侧也高：属于平台或相邻多个高点，首版保留。
    if (elevated(nearLeft) || elevated(nearRight)) continue
    // 两侧基线不一致：阶跃或爬升，保留。
    const tolerance = Math.max(params.minRiseMs, baseline) * params.sideAgreement
    if (Math.abs(median(left) - median(right)) > tolerance) continue

    mask[candidate.index] = true
  }

  // 兜底：不能让一条原本有数据的线整条消失。
  if (valid.every((candidate) => mask[candidate.index])) return samples.map(() => false)
  return mask
}

/** 遮蔽数组里被隐藏的格子数。 */
export function countMasked(mask: readonly boolean[] | undefined): number {
  return mask ? mask.reduce((total, hidden) => total + (hidden ? 1 : 0), 0) : 0
}
