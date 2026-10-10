// みちのり: クリアまでの道を おさるが歩く。見た目は components/Road.tsx が theme で切りかえる（play は何もしない）
import type { Show } from './types'

export type MichiTheme = 'jungle' | 'umi' | 'okashi' | 'uchu'
export type SkyStage = 'morning' | 'day' | 'evening' | 'night'

/** E（0〜1）→ 空の段階。朝 → 昼 → 夕焼け → 夜（E>=0.85） */
export function skyStage(E: number): SkyStage {
  if (E >= 0.85) return 'night'
  if (E >= 0.55) return 'evening'
  if (E >= 0.25) return 'day'
  return 'morning'
}

/** 道のとちゅうの目じるし（0〜1 の位置）。橋は 1/3、どうくつは 2/3 */
export const LANDMARKS = { bridge: 1 / 3, cave: 2 / 3 } as const

/** 前の位置から今の位置へ進むとき、その目じるしを通りすぎたか（ぴったり着いたときも） */
export const crossed = (prev: number, now: number, mark: number) => prev < mark - 1e-9 && now >= mark - 1e-9

/** 道の上の位置（0〜1）→ 横の％。スタートの旗からゴールの木の手前まで */
export const roadX = (p: number) => 7 + Math.max(0, Math.min(1, p)) * 72

const michi = (theme: MichiTheme, name: string, icon: string, extra: Partial<Show>): Show => ({
  id: `michi:${theme}`,
  cat: 'michi',
  name,
  icon,
  play: () => {}, // 見た目は Road が theme で切りかえる
  ...extra,
})

export const MICHI_SHOWS: Show[] = [
  michi('jungle', 'じゃんぐる', '🌴', { base: true }),
  michi('umi', 'うみのそこ', '🐠', { hint: '3にち あそぶ', unlock: (u) => u.playDays >= 3 }),
  michi('okashi', 'おかしのくに', '🍩', { hint: 'コースを3かい クリア', unlock: (u) => u.clears >= 3 }),
  michi('uchu', 'うちゅう', '🪐', { hint: '☆を ぜんぶで 30こ', unlock: (u) => u.starsTotal >= 30 }),
]

/** 演出の id から theme を取り出す */
export const themeOf = (showId: string | undefined): MichiTheme => {
  const t = showId?.replace(/^michi:/, '')
  return t === 'umi' || t === 'okashi' || t === 'uchu' ? t : 'jungle'
}
