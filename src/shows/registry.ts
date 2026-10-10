// 演出の一覧と、どれを使うかの選び方
import type { Rng } from '../lib/rng'
import type { Show, ShowCat, UnlockCtx } from './types'
import { BANANA_SHOWS } from './banana'
import { FINALE_SHOWS } from './finale'
import { MICHI_SHOWS } from './michi'
import { ONGAKU_SHOWS } from './ongaku'
import { UGOKU_SHOWS } from './ugoku'
import { ZUKKOKE_SHOWS } from './zukkoke'

export const SHOWS: Show[] = [...UGOKU_SHOWS, ...ZUKKOKE_SHOWS, ...MICHI_SHOWS, ...ONGAKU_SHOWS, ...FINALE_SHOWS, ...BANANA_SHOWS]

export const getShow = (id: string): Show | undefined => SHOWS.find((s) => s.id === id)

/** 手に入れている（はじめから持っている、または解放条件をみたした） */
export const isUnlocked = (show: Show, u: UnlockCtx): boolean => !!show.base || !!show.unlock?.(u)

/** そのカテゴリで手に入れている演出 */
export const ownedIn = (cat: ShowCat, u: UnlockCtx): Show[] => SHOWS.filter((s) => s.cat === cat && isUnlocked(s, u))

/**
 * 使う演出を選ぶ。pick[cat] が 'auto' か未設定なら、手に入れたものから乱数で選ぶ。
 * 固定されていて手に入れていればそれを使う（手に入れていない固定は無視して おまかせ）。
 * avoid（直前に使った id）は、ほかに選べるものがあるかぎり避ける
 */
export function pickShow(cat: ShowCat, pick: Record<string, string>, u: UnlockCtx, rng: Rng, avoid?: string): Show | undefined {
  const owned = ownedIn(cat, u)
  const fixed = pick[cat]
  if (fixed && fixed !== 'auto') {
    const s = owned.find((o) => o.id === fixed)
    if (s) return s
  }
  const choices = owned.length > 1 && avoid ? owned.filter((o) => o.id !== avoid) : owned
  return choices[Math.floor(rng() * choices.length)]
}

/** うごくえ: カテゴリに合うもので手に入れていればそれ、なければ基本の「ぴかっ」 */
export function ugokuFor(catName: string, u: UnlockCtx): Show {
  return SHOWS.find((s) => s.cat === 'ugoku' && s.forCat === catName && isUnlocked(s, u)) ?? getShow('ugoku:pika')!
}
