import { describe, expect, it } from 'vitest'
import { DEMO_GOAL, demoSession, demoWrongIndices, isDemoWrong, shouldRecord } from './demo'
import { MODE_RULES } from './quiz'
import { GUIDE_PAGES, shouldShowGuide } from './guide'
import { seeded } from './rng'
import voiceLines from '../../scripts/voice_lines.py?raw'

describe('デモは何も記録しない', () => {
  it('shouldRecord: デモは保存しない・ほかは保存する・テスト用のURLは保存しない', () => {
    expect(shouldRecord(MODE_RULES.demo, false)).toBe(false)
    expect(shouldRecord(MODE_RULES.course, false)).toBe(true)
    expect(shouldRecord(MODE_RULES.review, false)).toBe(true)
    expect(shouldRecord(MODE_RULES.practice, false)).toBe(true)
    expect(shouldRecord(MODE_RULES.course, true)).toBe(false)
  })
  it('デモはランキングにもコースにも入れず、ゲージは出す', () => {
    expect(MODE_RULES.demo).toEqual({ timer: true, ranked: false, course: false, record: false })
  })
})

describe('デモのわざとまちがえる問題', () => {
  it('10問のうち2問。はじめ2問と終わり（リーチ）をさけ、間をあける', () => {
    const w = demoWrongIndices()
    expect(w).toHaveLength(2)
    expect(w[0]).toBeGreaterThanOrEqual(2)
    expect(w[1]).toBeLessThanOrEqual(DEMO_GOAL - 3)
    expect(w[1] - w[0]).toBeGreaterThanOrEqual(3)
  })
  it('isDemoWrong: 決めた番号だけ。まちがえたあとの出なおしは正解する', () => {
    const w = demoWrongIndices()
    for (let i = 0; i < 14; i++) expect(isDemoWrong(i, false)).toBe(w.includes(i))
    expect(isDemoWrong(w[0], true)).toBe(false)
  })
  it('出題は絵のあるかんたんな問題で、まちがえの出なおしぶん多め・重複なし・カテゴリがばらばら', () => {
    const qs = demoSession(DEMO_GOAL + 2, seeded('demo'))
    expect(qs).toHaveLength(DEMO_GOAL + 2)
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length)
    expect(qs.every((q) => q.l <= 1 && q.img)).toBe(true)
    expect(new Set(qs.map((q) => q.c)).size).toBe(qs.length)
  })
})

describe('はじめてのガイド', () => {
  it('まだ見ていないときだけ自動で出す（1回見たら出さない）', () => {
    expect(shouldShowGuide(false)).toBe(true)
    expect(shouldShowGuide(true)).toBe(false)
  })
  it('3ページ', () => {
    expect(GUIDE_PAGES).toHaveLength(3)
  })
  it('読み上げる文は scripts/voice_lines.py にもある', () => {
    for (const p of GUIDE_PAGES) for (const t of [p.title, p.body]) expect(voiceLines, t).toContain(`'${t}'`)
  })
})
