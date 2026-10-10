// ライトナー式の箱。単語ごとに段 0〜5（段 = ☆の数）。☆1以上で「おぼえた」
// まちがえても段は下げない（罰なし）。次に出すとよい時刻 due が今に戻るだけ
import { daysBetween } from './day'
import type { WordStat } from './storage'

export const MAX_BOX = 5
/** 段 b から b+1 に上がるのに必要な、前回の段が変わった日からの日数 */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14]
/** 段 b に上がってから、次に出すとよい日までの日数（due） */
const DUE_DAYS = [0, 1, 3, 7, 14, 30]
/** due をすぎても「くもり」にならない猶予の日数（段ごと） */
const GRACE_DAYS = [0, 1, 2, 4, 7, 14]
const DAY_MS = 86400000

export type AnswerEvents = {
  /** 新しく☆1になった（0 → 1） */
  mastered: boolean
  /** 段が上がったときの新しい段 */
  starUp: number | null
  /** くもりを「みがいた」 */
  polished: boolean
}
const NO_EVENTS: AnswerEvents = { mastered: false, starUp: null, polished: false }

/** 今までの ok/ng/last から段の初期値を作る（古いデータの移しかえ） */
export function migrate(stat: WordStat): WordStat {
  if (stat.box !== undefined) return stat
  if (stat.ok >= 3 && stat.ng < stat.ok) {
    const at = stat.last || 0
    return { ...stat, box: 1, boxAt: at, due: at + DUE_DAYS[1] * DAY_MS, firstOkAt: at || undefined }
  }
  return { ...stat, box: 0, due: stat.last || 0 }
}

export const boxOf = (stat?: WordStat): number => (stat ? (migrate(stat).box ?? 0) : 0)

/** ☆の数 */
export const starsOf = boxOf

/** くもり: おぼえた単語が、due + 猶予をすぎても出てこなかった */
export function isCloudy(stat: WordStat | undefined, now: number): boolean {
  if (!stat) return false
  const s = migrate(stat)
  const box = s.box ?? 0
  return box >= 1 && now > (s.due ?? 0) + GRACE_DAYS[box] * DAY_MS
}

/** 出題の重み。くもり・まだ出ていない・まちがえた単語を多めに、ついさっき覚えたものは少なめに */
export function weight(stat: WordStat | undefined, now: number): number {
  if (!stat) return 3
  const s = migrate(stat)
  if (isCloudy(s, now)) return 5
  if ((s.box ?? 0) === 0) return 2 + Math.min(s.ng, 3)
  return now >= (s.due ?? 0) ? 2 : 0.3
}

/** その単語を「最初の答え」で答えた結果を反映する（純粋。stat は ok/ng などを数え終わったもの） */
export function applyAnswer(stat: WordStat, firstOk: boolean, nowMs: number): { stat: WordStat; events: AnswerEvents } {
  const s = migrate(stat)
  const box = s.box ?? 0
  if (!firstOk) return { stat: { ...s, due: nowMs }, events: NO_EVENTS }

  const firstOkAt = s.firstOkAt ?? nowMs
  // くもりをみがく: 段は保ったまま、次の確認を先に延ばす
  if (isCloudy(s, nowMs)) {
    return { stat: { ...s, boxAt: nowMs, due: nowMs + DUE_DAYS[box] * DAY_MS, firstOkAt }, events: { ...NO_EVENTS, polished: true } }
  }
  if (box >= MAX_BOX) {
    return { stat: { ...s, boxAt: nowMs, due: nowMs + DUE_DAYS[box] * DAY_MS, firstOkAt }, events: NO_EVENTS }
  }
  const waited = box === 0 || s.boxAt === undefined ? Infinity : daysBetween(s.boxAt, nowMs)
  if (waited >= INTERVAL_DAYS[box]) {
    const up = box + 1
    return { stat: { ...s, box: up, boxAt: nowMs, due: nowMs + DUE_DAYS[up] * DAY_MS, firstOkAt }, events: { mastered: box === 0, starUp: up, polished: false } }
  }
  // まだ日がたっていないので段はそのまま。まちがいで戻した due を、もとの予定に戻す
  return { stat: { ...s, due: (s.boxAt ?? 0) + DUE_DAYS[box] * DAY_MS, firstOkAt }, events: NO_EVENTS }
}
