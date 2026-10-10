// ひな壇: きねんしゃしんと えにっきの しゃしんの、おさると ことばの絵の並べ方（純粋）
// 座標は写真の枠の中の割合（0〜1）。x,y は絵の中心、size は枠の幅に対する絵の大きさ
export type Slot = { x: number; y: number; size: number }

export const PHOTO_MAX = 8
/** おさる（いちばん手前の まんなか） */
export const MONKEY_SLOT: Slot = { x: 0.5, y: 0.78, size: 0.34 }

// 前の段（おさるの両どなり）→ 中の段 → 奥の段
const fL: Slot = { x: 0.14, y: 0.8, size: 0.24 }
const fR: Slot = { x: 0.86, y: 0.8, size: 0.24 }
const mL: Slot = { x: 0.22, y: 0.54, size: 0.22 }
const mC: Slot = { x: 0.5, y: 0.5, size: 0.22 }
const mR: Slot = { x: 0.78, y: 0.54, size: 0.22 }
const bL: Slot = { x: 0.2, y: 0.26, size: 0.2 }
const bC: Slot = { x: 0.5, y: 0.24, size: 0.2 }
const bR: Slot = { x: 0.8, y: 0.26, size: 0.2 }

// 個数ごとの並べ方（少ないときも かたよらない）
const LAYOUTS: Slot[][] = [
  [],
  [mC],
  [fL, fR],
  [fL, fR, mC],
  [fL, fR, mL, mR],
  [fL, fR, mL, mC, mR],
  [fL, fR, mL, mC, mR, bC],
  [fL, fR, mL, mC, mR, bL, bR],
  [fL, fR, mL, mC, mR, bL, bC, bR],
]

/** ことばの絵 n 個ぶんの置き場所（最大8個。奥から手前の順に並べて返すので、そのまま重ねて描ける） */
export function riserLayout(n: number): Slot[] {
  const slots = LAYOUTS[Math.max(0, Math.min(PHOTO_MAX, Math.floor(n)))]
  return [...slots].sort((a, b) => a.y - b.y)
}

/** このプレイで正解した単語（重複なし）。写真に載せるのは新しいほう最大8個 */
export function photoWords<T extends { id: string; ok: boolean }>(answers: T[], max = PHOTO_MAX): string[] {
  const ids = [...new Set(answers.filter((a) => a.ok).map((a) => a.id))]
  return ids.slice(-max)
}
