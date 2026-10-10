// 進捗データの形。保存はキャラごと（players.ts）。ここは前のバージョン（1人ぶん）の読み込みだけ
const KEY = 'saru-quiz/v1'

/** box 以下は箱の段（leitner.ts）。古いデータにはないので省略可 */
export type WordStat = { ok: number; ng: number; last: number; box?: number; boxAt?: number; due?: number; firstOkAt?: number }
/** 直前のプレイの記録（「まえより のびたよ」用） */
export type LastResult = { correct: number; bestCombo: number; clearMs?: number; level: number; at: number }
/**
 * えにっきの1日ぶん。words: その日あてた単語（最大30）、mastered: その日 ☆1になった単語（古いデータにはない）、
 * sticker: その日もらったシールの種類 0〜6（もらっていなければなし）
 */
export type DiaryDay = { words: string[]; plays: number; mastered?: string[]; sticker?: number }
/** 演出図鑑（段階4で使う）。got: 手に入れた時刻、seen: 見たハプニング、pick: カテゴリごとの選択 */
export type ShowsSave = { got: Record<string, number>; seen: Record<string, number>; pick: Record<string, string> }
export type Save = {
  coins: number
  bestCombo: number
  plays: number
  /** クリアしたコース（かんたんクリア → ふつう解放、ふつうクリア → むずかしい解放） */
  cleared: number[]
  stats: Record<string, WordStat>
  /** 日付キー 'YYYY-MM-DD' ごとの、その日に遊んだ単語 */
  diary: Record<string, DiaryDay>
  /** 最初の答えでまちがえた単語（ふくしゅう用。最大30） */
  review: string[]
  /** 直前のプレイ（どのコースでも）。コースごとの記録は lastByLevel */
  lastResult?: LastResult
  /** コースごとの直前の結果（「まえより のびたよ」で比べる相手）。古いデータは normalizeSave で移す */
  lastByLevel: Record<number, LastResult>
  /** もらったシールの数（1日1枚。休んでも続きから） */
  stickers: number
  shows: ShowsSave
}

export const emptySave = (): Save => ({
  coins: 0,
  bestCombo: 0,
  plays: 0,
  cleared: [],
  stats: {},
  diary: {},
  review: [],
  lastByLevel: {},
  stickers: 0,
  shows: { got: {}, seen: {}, pick: {} },
})

/** 読み込んだ Save を今の形にそろえる（古いデータは lastResult を lastByLevel に移す） */
export function normalizeSave(save: Save): Save {
  const base = { ...emptySave(), ...save }
  const by = base.lastByLevel ?? {}
  const last = base.lastResult
  if (last && !by[last.level]) return { ...base, lastByLevel: { ...by, [last.level]: last } }
  return { ...base, lastByLevel: by }
}

/** 前のバージョンの進捗（キャラに引き継ぐため） */
export function loadOldSave(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeSave(JSON.parse(raw)) : emptySave()
  } catch {
    return emptySave()
  }
}
