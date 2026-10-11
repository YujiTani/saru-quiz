// ことば図鑑の集計（純粋な関数）。画面は screens/WordBook.tsx
// 「出た」= いちどでも答えた単語（stats がある）、「おぼえた」= ☆1以上
import { isCloudy, starsOf } from './leitner'
import { categories, playable, wordsOfCat, type Question } from './quiz'
import type { WordStat } from './storage'

type Stats = Record<string, WordStat>

export type WordCard = { q: Question; seen: boolean; stars: number; cloudy: boolean }
export type CatCount = { name: string; icon: string; /** 出題できる単語の数 */ total: number; /** いちどでも出た単語 */ seen: number; /** おぼえた（☆1以上） */ learned: number; stars: number }
export type BookTotals = { total: number; seen: number; learned: number; stars: number }

const isSeen = (stat?: WordStat): boolean => !!stat && stat.ok + stat.ng > 0

/** カテゴリの単語のカード。出た単語が先、まだのものはあと（それぞれ もとの並び） */
export function cardsOf(cat: string, stats: Stats, nowMs: number): WordCard[] {
  const cards = wordsOfCat(cat).map((q) => {
    const s = stats[q.id]
    return { q, seen: isSeen(s), stars: isSeen(s) ? starsOf(s) : 0, cloudy: isSeen(s) && isCloudy(s, nowMs) }
  })
  return [...cards.filter((c) => c.seen), ...cards.filter((c) => !c.seen)]
}

/** カテゴリごとの「おぼえた数 / 出題できる数」 */
export function catCounts(stats: Stats): CatCount[] {
  return categories.map((c) => {
    const cards = cardsOf(c.name, stats, 0)
    return { name: c.name, icon: c.icon, total: cards.length, seen: cards.filter((x) => x.seen).length, learned: cards.filter((x) => x.stars >= 1).length, stars: cards.reduce((a, x) => a + x.stars, 0) }
  })
}

/** ぜんぶの集計（おぼえたことば・☆の合計） */
export function bookTotals(stats: Stats): BookTotals {
  const t: BookTotals = { total: playable.length, seen: 0, learned: 0, stars: 0 }
  for (const q of playable) {
    const s = stats[q.id]
    if (!isSeen(s)) continue
    const n = starsOf(s)
    t.seen++
    t.stars += n
    if (n >= 1) t.learned++
  }
  return t
}
