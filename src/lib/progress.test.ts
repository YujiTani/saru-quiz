import { describe, expect, it } from 'vitest'
import { applyResult, firstAnswers } from './progress'
import { emptySave } from './storage'
import type { Save } from './storage'
import type { QuizResult } from '../screens/Quiz'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const T0 = at(2026, 1, 1)

const res = (answers: [string, boolean][], extra: Partial<QuizResult> = {}): QuizResult => ({
  correct: answers.filter(([, ok]) => ok).length,
  total: answers.length,
  coins: 10,
  bestCombo: 3,
  answers: answers.map(([id, ok]) => ({ id, ok })),
  cleared: false,
  ...extra,
})

describe('progress 最初の答え', () => {
  it('同じ id が2回出たら最初の ok だけ見る', () => {
    const m = firstAnswers(res([['a', false], ['b', true], ['a', true]]).answers)
    expect(m.get('a')).toBe(false)
    expect(m.get('b')).toBe(true)
  })

  it('まちがえてから正解した単語は、段が上がらない', () => {
    const { save, events } = applyResult(emptySave(), res([['a', false], ['a', true]]), T0, 1)
    expect(save.stats.a.box).toBe(0)
    expect(save.stats.a).toMatchObject({ ok: 1, ng: 1, last: T0 })
    expect(events.starUps).toEqual([])
  })

  it('最初で正解すると☆1。events に出る', () => {
    const { save, events } = applyResult(emptySave(), res([['a', true], ['b', false], ['b', true]]), T0, 1)
    expect(save.stats.a.box).toBe(1)
    expect(events.newMastered).toEqual(['a'])
    expect(events.starUps).toEqual([['a', 1]])
    expect(events.polished).toEqual([])
  })

  it('古い ok/ng から移しかえてから数える', () => {
    const base: Save = { ...emptySave(), stats: { a: { ok: 3, ng: 0, last: at(2025, 12, 31) } } }
    const { save, events } = applyResult(base, res([['a', true]]), T0, 1)
    expect(save.stats.a.ok).toBe(4)
    expect(save.stats.a.box).toBe(2) // 移しかえで段1、1日たっているので段2
    expect(events.starUps).toEqual([['a', 2]])
    expect(events.newMastered).toEqual([])
  })

  it('くもりをみがくと polished', () => {
    const base: Save = { ...emptySave(), stats: { a: { ok: 3, ng: 0, last: at(2025, 12, 1) } } }
    // 段1 の due は 12/2、猶予1日。ずっとあとなので、くもり
    const { events } = applyResult(base, res([['a', true]]), at(2026, 3, 1), 1)
    expect(events.polished).toEqual(['a'])
  })
})

describe('progress 記録', () => {
  it('coins / bestCombo / plays / cleared / lastResult', () => {
    const base: Save = { ...emptySave(), coins: 5, bestCombo: 9, plays: 2, cleared: [1] }
    const { save } = applyResult(base, res([['a', true]], { cleared: true, clearMs: 12345, bestCombo: 4 }), T0, 2)
    expect(save).toMatchObject({ coins: 15, bestCombo: 9, plays: 3, cleared: [1, 2] })
    expect(save.lastResult).toEqual({ correct: 1, bestCombo: 4, clearMs: 12345, level: 2, at: T0 })
    expect(applyResult(save, res([['a', true]], { cleared: true }), T0, 2).save.cleared).toEqual([1, 2])
  })

  it('元の Save を書きかえない', () => {
    const base = emptySave()
    applyResult(base, res([['a', true]]), T0, 1)
    expect(base).toEqual(emptySave())
  })

  it('diary: その日の単語（重複なし・最大30）と回数。firstPlayToday は1回目だけ', () => {
    const first = applyResult(emptySave(), res([['a', true], ['b', false], ['a', true]]), T0, 1)
    expect(first.events.firstPlayToday).toBe(true)
    expect(first.save.diary['2026-01-01']).toEqual({ words: ['a'], plays: 1 })

    const second = applyResult(first.save, res([['a', true], ['c', true]]), T0 + 3600_000, 1)
    expect(second.events.firstPlayToday).toBe(false)
    expect(second.save.diary['2026-01-01']).toEqual({ words: ['a', 'c'], plays: 2 })

    const nextDay = applyResult(second.save, res([['d', true]]), at(2026, 1, 2), 1)
    expect(nextDay.events.firstPlayToday).toBe(true)
    expect(Object.keys(nextDay.save.diary)).toEqual(['2026-01-01', '2026-01-02'])

    const many = res(Array.from({ length: 40 }, (_, i) => [`w${i}`, true] as [string, boolean]))
    expect(applyResult(emptySave(), many, T0, 1).save.diary['2026-01-01'].words).toHaveLength(30)
  })

  it('review: 最初の答えでまちがえた単語だけ入る', () => {
    const { save } = applyResult(emptySave(), res([['a', false], ['a', true], ['b', true], ['c', false]]), T0, 1)
    expect(save.review).toEqual(['a', 'c'])
  })

  it('review: 通常のプレイでは正解しても外れない。ふくしゅうモードで最初に正解すると外れる', () => {
    const base: Save = { ...emptySave(), review: ['a', 'b'] }
    expect(applyResult(base, res([['a', true]]), T0, 1).save.review).toEqual(['a', 'b'])
    expect(applyResult(base, res([['a', true], ['b', false], ['b', true]]), T0, 1, true).save.review).toEqual(['b'])
  })

  it('review: 最大30（古いものから落とす）', () => {
    const base: Save = { ...emptySave(), review: Array.from({ length: 30 }, (_, i) => `r${i}`) }
    const { save } = applyResult(base, res([['x', false]]), T0, 1)
    expect(save.review).toHaveLength(30)
    expect(save.review[0]).toBe('r1')
    expect(save.review[29]).toBe('x')
  })
})
