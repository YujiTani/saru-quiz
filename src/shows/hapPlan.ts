// ハプニングを いつ・どれ起こすかの決めかた（純粋）。
// 日付・キャラ・その日の遊んだ回数から作る乱数（seeded）で、遊び始めに決める。同じ日・同じ回数なら 毎回同じ結果（?seed ごとにも再現できる）
import { seeded } from '../lib/rng'

export type HapPlan = { id: string; at: number }

/** ハプニングが起きるのは 何問目まで（読み上げ中に出すので、あまり遅いと終わってしまう） */
export const HAP_AT_MAX = 9

/**
 * 1回のプレイで起きる確率。その日の1回目が いちばん高く、遊ぶほど少しずつ下がる。
 * 1日に1〜2回遊ぶと、だいたい1日1回くらい見られる（0回か1回。1回のプレイに2つは起きない）
 */
export function hapChance(playsToday: number): number {
  return [0.6, 0.5, 0.4][Math.max(0, Math.floor(playsToday))] ?? 0.3
}

export type PlanInput = {
  /** 日付キー YYYY-MM-DD */
  day: string
  charId: string
  /** その日 すでに遊んだ回数（diary の plays） */
  plays: number
  /** 見たハプニング（save.shows.seen） */
  seen: Record<string, number>
  /** クリアに必要な数（何問目で起こすかの上限に使う） */
  goal: number
  /** 起こせるハプニングの id（登録の順） */
  ids: string[]
  /** ?seed の値（なければ ''） */
  salt?: string
}

/** 起こすなら { id, at(何問目か。2〜) }、起こさなければ null。まだ見ていないものを優先する */
export function planHappening(p: PlanInput): HapPlan | null {
  const maxAt = Math.min(HAP_AT_MAX, p.goal)
  if (p.ids.length === 0 || maxAt < 2) return null
  const r = seeded(`hap|${p.day}|${p.charId}|${p.plays}|${p.salt ?? ''}`)
  if (r() >= hapChance(p.plays)) return null
  const unseen = p.ids.filter((id) => p.seen[id] === undefined)
  const pool = unseen.length > 0 ? unseen : p.ids
  const id = pool[Math.floor(r() * pool.length)]
  const at = 2 + Math.floor(r() * (maxAt - 1)) // 2〜maxAt
  return { id, at }
}

/** ?hap=<id> のテスト用: かならず2問目に そのハプニング */
export const forcedPlan = (id: string): HapPlan => ({ id, at: 2 })
