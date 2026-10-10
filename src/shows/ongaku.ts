// おんがく: ふだんのBGMの曲。旋律は lib/bgm.ts（play は何もしない。Quiz が startBgm に渡す）
import type { Show } from './types'

const ongaku = (id: string, name: string, icon: string, extra: Partial<Show>): Show => ({ id: `ongaku:${id}`, cat: 'ongaku', name, icon, play: () => {}, ...extra })

export const ONGAKU_SHOWS: Show[] = [
  ongaku('march', 'じゃんぐるまーち', '🥁', { base: true }),
  ongaku('matsuri', 'おまつり', '🏮', { hint: '3にち あそぶ', unlock: (u) => u.playDays >= 3 }),
  ongaku('omocha', 'おもちゃのぎょうれつ', '🧸', { hint: 'コースを3かい クリア', unlock: (u) => u.clears >= 3 }),
  ongaku('komoriuta', 'ねんねのこもりうた', '🌙', { hint: '☆を ぜんぶで 20こ', unlock: (u) => u.starsTotal >= 20 }),
]
