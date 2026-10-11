import { describe, expect, it } from 'vitest'
import { dayKey } from './day'
import { clearAll, clearWord, playSummary, recentPlays, recordedWords, troubleWords } from './parent'
import { playable } from './quiz'
import { emptySave, type Save, type WordStat } from './storage'

const DAY = 86400000
const NOW = new Date(2026, 0, 10, 12).getTime()
const [a, b, c, d] = playable.slice(0, 4).map((q) => q.id)
const st = (ok: number, ng: number, box = 1, extra: Partial<WordStat> = {}): WordStat => ({ ok, ng, last: NOW, box, boxAt: NOW, due: NOW + 10 * DAY, ...extra })

const save: Save = {
  ...emptySave(),
  plays: 7,
  coins: 900,
  stickers: 3,
  cleared: [1],
  review: [a, b],
  stats: { [a]: st(5, 2, 2), [b]: st(1, 4, 0), [c]: st(9, 0, 3), [d]: st(2, 4, 1, { boxAt: NOW - 100 * DAY, due: NOW - 99 * DAY }) },
  diary: { '2026-01-10': { words: [], plays: 2 }, '2026-01-08': { words: [], plays: 1 }, '2025-12-01': { words: [], plays: 3 }, '2026-01-09': { words: [], plays: 0 } },
}

describe('保護者メニューの集計', () => {
  it('このキャラの記録のまとめ', () => {
    expect(playSummary(save, NOW)).toEqual({ days: 3, learned: 3, stars: 6, cloudy: 1, correct: 17, plays: 7 })
    expect(playSummary(emptySave(), NOW)).toEqual({ days: 0, learned: 0, stars: 0, cloudy: 0, correct: 0, plays: 0 })
  })

  it('最近7日: 古い日が先・今日が最後。遊んでいない日は0', () => {
    const w = recentPlays(save, NOW, 7)
    expect(w.map((x) => x.day)).toEqual(['2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'])
    expect(w.map((x) => x.plays)).toEqual([0, 0, 0, 0, 1, 0, 2])
    expect(w[6].day).toBe(dayKey(NOW))
  })
})

describe('苦手なことばの並べ方', () => {
  it('ng が多い順。同じなら ok が少ないほうが先。ng 0 は入れない', () => {
    const t = troubleWords(save.stats)
    expect(t.map((x) => x.q.id)).toEqual([b, d, a])
    expect(t.map((x) => [x.ok, x.ng])).toEqual([[1, 4], [2, 4], [5, 2]])
  })

  it('最大語数で切る。ない id は飛ばす', () => {
    const many: Record<string, WordStat> = {}
    playable.slice(0, 30).forEach((q, i) => (many[q.id] = st(0, i + 1)))
    many['nothing'] = st(0, 99)
    const t = troubleWords(many, 10)
    expect(t).toHaveLength(10)
    expect(t[0].ng).toBe(30)
    expect(t.every((x, i) => i === 0 || t[i - 1].ng >= x.ng)).toBe(true)
    expect(troubleWords({})).toEqual([])
  })
})

describe('記録を消す', () => {
  it('1語の記録を消す: stats と review から外れる。ほかは そのまま', () => {
    const r = clearWord(save, a)
    expect(r.stats[a]).toBeUndefined()
    expect(Object.keys(r.stats)).toEqual([b, c, d])
    expect(r.review).toEqual([b])
    expect(r.coins).toBe(900)
    expect(r.diary).toEqual(save.diary)
    expect(save.stats[a]).toBeDefined() // もとのデータは変えない
    expect(playSummary(r, NOW).learned).toBe(2)
  })

  it('記録のない語を消しても何も起きない', () => {
    expect(clearWord(save, 'nothing')).toEqual(save)
  })

  it('消す相手の候補: 記録のある単語を、ことば・カテゴリで絞る', () => {
    expect(recordedWords(save.stats).map((q) => q.id).sort()).toEqual([a, b, c, d].sort())
    const q = playable.find((x) => x.id === a)!
    expect(recordedWords(save.stats, q.a.slice(0, 1)).some((x) => x.id === a)).toBe(true)
    expect(recordedWords(save.stats, '', 'ないカテゴリ')).toEqual([])
    expect(recordedWords(save.stats, q.a, q.c).some((x) => x.id === a)).toBe(true)
  })

  it('ぜんぶ消す: 最初の状態に戻る（stats・バナナ・シール・えにっき・解放）', () => {
    const r = clearAll()
    expect(r).toEqual(emptySave())
    expect(r.stats).toEqual({})
    expect(r.coins).toBe(0)
    expect(r.cleared).toEqual([])
  })
})
