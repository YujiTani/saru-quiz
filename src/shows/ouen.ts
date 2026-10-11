// おうえん: ふだんのプレイ中、画面のふち（絵のカードの左右・上）に出てくる観客。描くのは components/Cheer.tsx
// どれも E（進み具合）が上がるほど にぎやか。play は何もしない（Quiz が 遊び始めに選んで Cheer に渡す）
import type { Show } from './types'

const ouen = (id: string, name: string, icon: string, extra: Partial<Show>): Show => ({ id: `ouen:${id}`, cat: 'ouen', name, icon, play: () => {}, ...extra })

export const OUEN_SHOWS: Show[] = [
  ouen('osaru', 'おさるおうえんだん', '🚩', { base: true }),
  ouen('kotori', 'ことりのコーラス', '🐦', { hint: 'とりを 5ことば おぼえる', unlock: (u) => (u.masteredByCat['とり'] ?? 0) >= 5 }),
]

/** 左右のふちに置ける数（左右 6 ずつ） */
export const CHEER_SLOTS = 12
/** 電線にとまれる ことりの数 */
export const BIRD_MAX = 5

/** おさるおうえんだんの数。E が上がるほど増える（1〜12） */
export const osaruCount = (E: number): number => Math.max(1, Math.min(CHEER_SLOTS, 1 + Math.floor(Math.max(0, E) * 11)))

/** ことりの数。正解が増えるたびに1羽ずつ（最大5） */
export const birdCount = (correct: number): number => Math.max(0, Math.min(BIRD_MAX, Math.floor(correct)))

/** k 番目の置き場所。左右に交互に、下から上へ（row 0〜5）。y は絵のカードの高さに対する %（中心） */
export function cheerSlot(k: number): { side: 'left' | 'right'; row: number; y: number } {
  const i = ((Math.floor(k) % CHEER_SLOTS) + CHEER_SLOTS) % CHEER_SLOTS
  const row = Math.floor(i / 2)
  return { side: i % 2 === 0 ? 'left' : 'right', row, y: 90 - row * 15 }
}
