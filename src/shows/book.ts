// えんしゅつ図鑑の純粋な部分: 新しく手に入れたものの判定、記録、集計
import { SHOWS, isUnlocked } from './registry'
import type { Show, ShowCat, UnlockCtx } from './types'

/** 図鑑のタブ（この順に並べる）。まだ0件のカテゴリも出す（「もうすぐ」） */
export const BOOK_CATS: { cat: ShowCat; label: string; icon: string }[] = [
  { cat: 'ugoku', label: 'うごくえ', icon: '🐰' },
  { cat: 'michi', label: 'みちのり', icon: '🌴' },
  { cat: 'ongaku', label: 'おんがく', icon: '🎵' },
  { cat: 'zukkoke', label: 'ずっこけ', icon: '🤪' },
  { cat: 'deteku', label: 'でてくる', icon: '🎁' },
  { cat: 'ouen', label: 'おうえん', icon: '📣' },
  { cat: 'finale', label: 'ふぃなーれ', icon: '📷' },
  { cat: 'happening', label: 'ハプニング', icon: '🎈' },
  { cat: 'banana', label: 'バナナのやま', icon: '🍌' },
]

/** 手に入れている。ハプニングは「みつけた」（見たら）。got は手に入れた記録（一度手に入れたものは なくならない） */
export function isOwned(show: Show, u: UnlockCtx, got: Record<string, number> = {}): boolean {
  if (show.cat === 'happening' && u.seen[show.id] !== undefined) return true
  return isUnlocked(show, u) || got[show.id] !== undefined
}

/** あたらしく手に入れた演出の id（before では持っていなくて、after では持っている）。登録の順 */
export function newlyUnlocked(before: UnlockCtx, after: UnlockCtx, shows: Show[] = SHOWS): string[] {
  return shows.filter((s) => !isOwned(s, before) && isOwned(s, after)).map((s) => s.id)
}

/**
 * got（手に入れた時刻の記録）を更新する。
 * - あたらしく手に入れたもの → got に入れて newShows に返す
 * - はじめから持っているもの（base）や、記録をつける前に手に入れていたもの → got にだけ入れる（newShows には出さない）
 */
export function grantShows(got: Record<string, number>, before: UnlockCtx, after: UnlockCtx, nowMs: number, shows: Show[] = SHOWS): { got: Record<string, number>; newShows: string[] } {
  const next = { ...got }
  for (const s of shows) if (isOwned(s, before) && next[s.id] === undefined) next[s.id] = nowMs
  const newShows = newlyUnlocked(before, after, shows)
  for (const id of newShows) next[id] = nowMs
  return { got: next, newShows }
}

export type Count = { got: number; total: number }

/** 図鑑の集計: 全体と、カテゴリごとの「手に入れた数 / 全部の数」 */
export function bookCounts(u: UnlockCtx, got: Record<string, number> = {}, shows: Show[] = SHOWS): { all: Count; byCat: Record<ShowCat, Count> } {
  const byCat = Object.fromEntries(BOOK_CATS.map((c) => [c.cat, { got: 0, total: 0 }])) as Record<ShowCat, Count>
  const all: Count = { got: 0, total: 0 }
  for (const s of shows) {
    const c = byCat[s.cat]
    const own = isOwned(s, u, got)
    c.total++
    all.total++
    if (own) {
      c.got++
      all.got++
    }
  }
  return { all, byCat }
}

/** カテゴリの演出（登録の順） */
export const showsOf = (cat: ShowCat, shows: Show[] = SHOWS): Show[] => shows.filter((s) => s.cat === cat)
