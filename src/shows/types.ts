// 演出エンジンの型。演出1つ = Show。あとの段階（図鑑・解放・ハプニングなど）もこの形に乗せる
import type { Rng } from '../lib/rng'
import type { Question } from '../lib/quiz'
import type { sfx } from '../lib/sound'
import type { ShowLayer } from './layer'

export type ShowCat = 'ugoku' | 'michi' | 'ongaku' | 'zukkoke' | 'deteku' | 'ouen' | 'finale' | 'happening' | 'banana'

/** 解放条件に使う集計（Save から unlockCtx で作る） */
export type UnlockCtx = {
  /** おぼえた単語（☆1以上）の数 */
  masteredTotal: number
  masteredByCat: Record<string, number>
  starsTotal: number
  /** 遊んだ日の数（えにっきの日数） */
  playDays: number
  plays: number
  /** クリアしたコースの数 */
  clears: number
  /** くもりをみがいた単語の数（今は0） */
  polishedTotal: number
  /** 見たハプニング */
  seen: Record<string, number>
  /** ためたバナナの合計（バナナのやま） */
  coins: number
}

export type ShowCtx = {
  layer: ShowLayer
  /** 問題の絵の枠（.picture）。なければ null */
  pic: HTMLElement | null
  /** 司会のおさる（.host-monkey）。なければ null */
  host: HTMLElement | null
  q?: Question
  /** クリアまでの進み具合 0〜1 */
  E: number
  /** ねつのレベル（フィーバーの勢い） */
  heat: number
  /** 動きの強さ 0〜1 */
  motion: number
  rng: Rng
  speak: (text: string | string[]) => Promise<unknown>
  sfx: typeof sfx
  /** 演出の中心にしたい画面上の点（正解した選択肢の位置など）。なければ絵の中心 */
  at?: { x: number; y: number }
  /** いまの れんぞく数 */
  combo?: number
  /** このプレイで正解した単語（重複なし。新しいほうが後ろ）。フィナーレなどが使う */
  today?: Question[]
  /** 図鑑の「ためす」やプレゼントの再生か（吹き出しの言葉も読み上げる。ゲーム中は、ほめ言葉の読み上げとぶつかるので読まない） */
  preview?: boolean
}

export type Show = {
  id: string
  cat: ShowCat
  name: string
  icon: string
  /** はじめから持っている */
  base?: boolean
  /** 親向けの解放条件の説明 */
  hint?: string
  unlock?: (u: UnlockCtx) => boolean
  /** うごくえの対象カテゴリ名（questions.json の categories[].name） */
  forCat?: string
  play: (ctx: ShowCtx) => Promise<void> | void
}
