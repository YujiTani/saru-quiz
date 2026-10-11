// はじめてのガイド（3ページ）の中身と、出すかどうかの判定
export type GuidePage = { title: string; body: string }

/** タイトルと説明は、そのまま読み上げる（scripts/voice_lines.py にも同じ文がある） */
export const GUIDE_PAGES: GuidePage[] = [
  { title: 'えを みて、なまえを あてよう！', body: 'えらんで、これ！を おしてね' },
  { title: 'あたると、えが うごくよ！', body: 'みちを すすんで、バナナの きを めざそう！' },
  { title: 'まいにち あそぶと、えにっきに シールが はれるよ！', body: 'さあ、あそぼう！' },
]

/** ガイドを自動で出すか（まだ見ていないときだけ。1回見たら二度と自動では出ない） */
export const shouldShowGuide = (guideSeen: boolean): boolean => !guideSeen
