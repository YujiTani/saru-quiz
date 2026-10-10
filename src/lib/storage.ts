// 進捗データの形。保存はキャラごと（players.ts）。ここは前のバージョン（1人ぶん）の読み込みだけ
const KEY = 'saru-quiz/v1'

export type WordStat = { ok: number; ng: number; last: number }
export type Save = {
  coins: number
  bestCombo: number
  plays: number
  /** クリアしたコース（かんたんクリア → ふつう解放、ふつうクリア → むずかしい解放） */
  cleared: number[]
  stats: Record<string, WordStat>
}

export const emptySave = (): Save => ({ coins: 0, bestCombo: 0, plays: 0, cleared: [], stats: {} })

/** 前のバージョンの進捗（キャラに引き継ぐため） */
export function loadOldSave(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...emptySave(), ...JSON.parse(raw) } : emptySave()
  } catch {
    return emptySave()
  }
}
