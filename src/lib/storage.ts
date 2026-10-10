// 進捗の保存（端末内）。P4 で IndexedDB に移す予定
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

const empty = (): Save => ({ coins: 0, bestCombo: 0, plays: 0, cleared: [], stats: {} })

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    return empty()
  }
}

export function save(data: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // プライベートモード等で保存できなくても遊べるようにする
  }
}
