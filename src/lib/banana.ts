// バナナのやま: ためたバナナの合計（save.coins）が「もの」の大きさで伝わる（純粋）
export type BananaStage = { id: string; name: string; icon: string; need: number; /** カードの文字 */ card: string; /** 読み上げ（voice_lines.py にも入れる） */ say: string }

// しきい値の決め方: 1回のプレイでもらえるバナナは、3歳の子が10問前後あてて 150〜500 くらい
// （正解ごとに 10 × (1+れんぞく÷3) × フィーバーばい。Quiz.tsx の add）。
// 最初の段は 2〜3回、そのあとは およそ 2〜2.5倍ずつ 遠くなる（ねこぐるま 15回ほど … ほし 100回以上）
export const BANANA_STAGES: BananaStage[] = [
  { id: 'fusa', name: 'ひとふさ', icon: '🍌', need: 0, card: 'ひとふさ', say: 'バナナが、ひとふさに、なったよ！' },
  { id: 'kago', name: 'かご', icon: '🧺', need: 600, card: 'かごいっぱい', say: 'バナナが、かごいっぱいに、なったよ！' },
  { id: 'nekoguruma', name: 'ねこぐるま', icon: '🛒', need: 1500, card: 'ねこぐるまいっぱい', say: 'バナナが、ねこぐるまいっぱいに、なったよ！' },
  { id: 'truck', name: 'トラック', icon: '🚚', need: 3500, card: 'トラックいっぱい', say: 'バナナが、トラックいっぱいに、なったよ！' },
  { id: 'fune', name: 'ふね', icon: '🚢', need: 8000, card: 'ふねいっぱい', say: 'バナナが、ふねいっぱいに、なったよ！' },
  { id: 'shima', name: 'しま', icon: '🏝️', need: 18000, card: 'しまいっぱい', say: 'バナナが、しまいっぱいに、なったよ！' },
  { id: 'hoshi', name: 'バナナのほし', icon: '🌕', need: 40000, card: 'ほしいっぱい', say: 'バナナが、ほしいっぱいに、なったよ！' },
]

/** バナナの合計から今の段階（0〜6） */
export function bananaStage(coins: number): number {
  let s = 0
  for (let i = 1; i < BANANA_STAGES.length; i++) if (coins >= BANANA_STAGES[i].need) s = i
  return s
}

/** このプレイの前後で段階が上がったか。上がったら新しい段階、変わらなければ null */
export function stageUp(before: number, after: number): number | null {
  const a = bananaStage(before)
  const b = bananaStage(after)
  return b > a ? b : null
}
