import { describe, expect, it } from 'vitest'
import { categories, playable, wordsOfCat } from './quiz'
import type { WordStat } from './storage'
import { bookTotals, cardsOf, catCounts } from './wordbook'

const DAY = 86400000
const NOW = new Date(2026, 0, 1, 12).getTime()
const ids = wordsOfCat('どうぶつ').map((q) => q.id)

const seen = (box: number, extra: Partial<WordStat> = {}): WordStat => ({ ok: 2, ng: 0, last: NOW, box, boxAt: NOW, due: NOW + 10 * DAY, ...extra })

describe('ことば図鑑の集計', () => {
  const stats: Record<string, WordStat> = {
    [ids[3]]: seen(2),
    [ids[5]]: seen(1),
    [ids[7]]: { ok: 0, ng: 2, last: NOW, box: 0, due: NOW }, // 出たけど まだおぼえていない
    [wordsOfCat('とり')[0].id]: seen(5),
  }

  it('カテゴリは全部（21）。出題できる数は playable と合う', () => {
    const c = catCounts({})
    expect(c).toHaveLength(categories.length)
    expect(c.reduce((a, x) => a + x.total, 0)).toBe(playable.length)
    expect(c.every((x) => x.seen === 0 && x.learned === 0 && x.stars === 0)).toBe(true)
  })

  it('カテゴリごとの おぼえた数（☆1以上）と出た数', () => {
    const d = catCounts(stats).find((x) => x.name === 'どうぶつ')!
    expect(d).toMatchObject({ total: ids.length, seen: 3, learned: 2, stars: 3 })
    const b = catCounts(stats).find((x) => x.name === 'とり')!
    expect(b).toMatchObject({ seen: 1, learned: 1, stars: 5 })
  })

  it('全体の集計: おぼえたことば・☆の合計', () => {
    expect(bookTotals(stats)).toEqual({ total: playable.length, seen: 4, learned: 3, stars: 8 })
    expect(bookTotals({})).toEqual({ total: playable.length, seen: 0, learned: 0, stars: 0 })
  })

  it('カード: 出た単語が先。まだの単語は影（seen=false・☆なし）', () => {
    const cards = cardsOf('どうぶつ', stats, NOW)
    expect(cards).toHaveLength(ids.length)
    expect(cards.slice(0, 3).map((c) => c.q.id)).toEqual([ids[3], ids[5], ids[7]])
    expect(cards.slice(0, 3).map((c) => c.stars)).toEqual([2, 1, 0])
    expect(cards.slice(3).every((c) => !c.seen && c.stars === 0 && !c.cloudy)).toBe(true)
  })

  it('くもり: おぼえた単語が期限+猶予をすぎたら。出ていない単語はくもりにならない', () => {
    const old = NOW - 100 * DAY
    const s = { [ids[0]]: seen(2, { boxAt: old, due: old + 3 * DAY, last: old }), [ids[1]]: seen(2) }
    const cards = cardsOf('どうぶつ', s, NOW)
    expect(cards.find((c) => c.q.id === ids[0])!.cloudy).toBe(true)
    expect(cards.find((c) => c.q.id === ids[1])!.cloudy).toBe(false)
    expect(cards.filter((c) => c.cloudy)).toHaveLength(1)
  })

  it('古い形の記録（box がない）も数える', () => {
    const c = catCounts({ [ids[0]]: { ok: 5, ng: 0, last: NOW } }).find((x) => x.name === 'どうぶつ')!
    expect(c).toMatchObject({ seen: 1, learned: 1 })
  })
})
