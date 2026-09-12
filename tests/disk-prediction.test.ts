import { describe, expect, it } from 'vitest'
import {
  analyzeDiskPrediction,
  DISK_PREDICTION_MIN_SAMPLE_DAYS,
  diskPredictionSummary,
} from '@/domain/disk-prediction'
import { normalizeHistory } from '@/services/cfsm/adapters'

const START = 1_700_000_000_000
const DAY = 86_400_000

/** 用真实的 `/api/history/all` 行构造采样点，保证测的是线上同一条归一化路径。 */
function history(rows: ReadonlyArray<{ day: number, used: number | null, total?: number | null }>) {
  return normalizeHistory(rows.map((row) => ({
    timestamp: START + row.day * DAY,
    disk_used: row.used,
    disk_total: row.total === undefined ? 10_000 : row.total,
  })))
}

describe('磁盘耗尽预测', () => {
  it('沿用上游的两天样本门槛', () => {
    expect(DISK_PREDICTION_MIN_SAMPLE_DAYS).toBe(2)
  })

  it('没有可用采样时不预测', () => {
    const state = analyzeDiskPrediction(history([]))
    expect(state).toMatchObject({ prediction: null, reason: 'no_samples', sampleCount: 0 })
    expect(diskPredictionSummary(state, 30).text).toBe('暂无趋势')
  })

  it('只有一个采样时不预测', () => {
    const state = analyzeDiskPrediction(history([{ day: 0, used: 1_000 }]))
    expect(state).toMatchObject({ prediction: null, reason: 'insufficient_samples' })
    expect(diskPredictionSummary(state, 30).text).toBe('样本不足')
  })

  it('样本跨度不足两天时只说明趋势还在积累', () => {
    const state = analyzeDiskPrediction(history([
      { day: 0, used: 1_000 },
      { day: 0.5, used: 1_200 },
      { day: 1, used: 1_400 },
    ]))
    expect(state).toMatchObject({ prediction: null, reason: 'insufficient_duration' })
    expect(state.sampleDays).toBeCloseTo(1, 6)
    expect(diskPredictionSummary(state, 30).text).toBe('趋势积累中')
  })

  it('线性增长时给出天数、日增量与拟合优度', () => {
    const state = analyzeDiskPrediction(history([
      { day: 0, used: 1_000 },
      { day: 1, used: 2_000 },
      { day: 2, used: 3_000 },
      { day: 3, used: 4_000 },
      { day: 4, used: 5_000 },
    ]))
    expect(state.prediction?.dailyGrowth).toBeCloseTo(1_000, 6)
    expect(state.prediction?.daysUntilFull).toBeCloseTo(5, 6)
    expect(state.prediction?.confidence).toBeCloseTo(1, 6)
    expect(state.sampleDays).toBeCloseTo(4, 6)
  })

  it('用量没有增长时不给耗尽天数', () => {
    const state = analyzeDiskPrediction(history([
      { day: 0, used: 3_000 },
      { day: 2, used: 3_000 },
      { day: 4, used: 3_000 },
    ]))
    expect(state).toMatchObject({ prediction: null, reason: 'no_growth' })
    expect(diskPredictionSummary(state, 30).text).toBe('')
  })

  it('已经写满时天数为 0', () => {
    const state = analyzeDiskPrediction(history([
      { day: 0, used: 8_000 },
      { day: 2, used: 9_000 },
      { day: 4, used: 10_000 },
    ]))
    expect(state.prediction?.daysUntilFull).toBe(0)
    expect(diskPredictionSummary(state, 30)).toEqual({ text: '预计已满', warning: true })
  })

  it('历史行缺少总量时回落到节点当前的磁盘总量', () => {
    const rows = history([
      { day: 0, used: 1_000, total: null },
      { day: 2, used: 2_000, total: null },
      { day: 4, used: 3_000, total: null },
    ])
    expect(analyzeDiskPrediction(rows)).toMatchObject({ prediction: null, reason: 'no_samples' })
    expect(analyzeDiskPrediction(rows, 10_000).prediction?.daysUntilFull).toBeCloseTo(14, 6)
  })

  it('缺失的采样点被跳过，不当作 0 参与回归', () => {
    const complete = analyzeDiskPrediction(history([
      { day: 0, used: 1_000 },
      { day: 2, used: 2_000 },
      { day: 4, used: 3_000 },
    ]))
    const withGap = analyzeDiskPrediction(history([
      { day: 0, used: 1_000 },
      { day: 1, used: null },
      { day: 2, used: 2_000 },
      { day: 3, used: null },
      { day: 4, used: 3_000 },
    ]))
    expect(withGap.sampleCount).toBe(3)
    expect(withGap.prediction?.dailyGrowth).toBeCloseTo(complete.prediction?.dailyGrowth ?? 0, 6)
    expect(withGap.prediction?.daysUntilFull).toBeCloseTo(complete.prediction?.daysUntilFull ?? 0, 6)
  })

  it('预警阈值只影响提示色，不改变预测值', () => {
    const state = analyzeDiskPrediction(history([
      { day: 0, used: 1_000 },
      { day: 2, used: 3_000 },
      { day: 4, used: 5_000 },
    ]))
    expect(diskPredictionSummary(state, 30)).toEqual({ text: '预计 5 天后满', warning: true })
    expect(diskPredictionSummary(state, 3)).toEqual({ text: '预计 5 天后满', warning: false })
  })

  it('关闭时由调用方跳过，函数本身对空历史保持沉默', () => {
    expect(diskPredictionSummary(analyzeDiskPrediction([]), 30)).toEqual({ text: '暂无趋势', warning: false })
  })
})
