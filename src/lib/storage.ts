// 進捗データの形。保存はキャラごと（players.ts）。ここは前のバージョン（1人ぶん）の読み込みだけ
const KEY = 'saru-quiz/v1'

/** box 以下は箱の段（leitner.ts）。古いデータにはないので省略可 */
export type WordStat = { ok: number; ng: number; last: number; box?: number; boxAt?: number; due?: number; firstOkAt?: number }
/** 直前のプレイの記録（「まえより のびたよ」用） */
export type LastResult = { correct: number; bestCombo: number; clearMs?: number; level: number; at: number }
/** えにっきの1日ぶん（単語は最大30） */
export type DiaryDay = { words: string[]; plays: number }
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
  lastResult?: LastResult
  /** もらったシールの数（段階3で使う） */
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
  stickers: 0,
  shows: { got: {}, seen: {}, pick: {} },
})

/** 前のバージョンの進捗（キャラに引き継ぐため） */
export function loadOldSave(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...emptySave(), ...JSON.parse(raw) } : emptySave()
  } catch {
    return emptySave()
  }
}
