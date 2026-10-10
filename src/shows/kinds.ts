// うごくえで使う、単語や日付の見分け（純粋）
import type { Kind } from '../lib/effects'

export type Weather = 'rain' | 'snow' | 'rainbow' | 'sun' | 'thunder' | 'wind' | 'sparkle'

// しぜん・てんき の単語 id（英語）から天気を見分ける。どれにも当たらなければ きらきら
const WEATHER: [RegExp, Weather][] = [
  [/^(rain|puddle|typhoon)$/, 'rain'],
  [/^(snow|snowman|icicles|ice-cubes)$/, 'snow'],
  [/^rainbow$/, 'rainbow'],
  [/^(sun|sunset)$/, 'sun'],
  [/^lightning$/, 'thunder'],
  [/^(wind|tornado)$/, 'wind'],
]

export function weatherOf(q: { id: string } | undefined): Weather {
  const id = q?.id ?? ''
  return WEATHER.find(([re]) => re.test(id))?.[1] ?? 'sparkle'
}

/** きせつ・ぎょうじ: 月（1〜12）→ 降らせる粒子。3〜5月は花びら、6〜8月は泡、9〜11月は葉っぱ、12〜2月は雪 */
export function seasonOf(month: number): { kind: Kind; name: string } {
  if (month >= 3 && month <= 5) return { kind: 'petal', name: 'はる' }
  if (month >= 6 && month <= 8) return { kind: 'bubble', name: 'なつ' }
  if (month >= 9 && month <= 11) return { kind: 'leaf', name: 'あき' }
  return { kind: 'snow', name: 'ふゆ' }
}

// ふく・みにつけるもの のうち、頭にのせるもの（id）。それ以外は からだに重ねる
const HEAD = /^(hat|ribbon-bow|glasses|crown|sunglasses|hair-clip|headband|swim-goggles|baseball-cap|helmet|tiara|hair-tie-scrunchie|earmuffs)$/

export const wearsOnHead = (q: { id: string } | undefined): boolean => HEAD.test(q?.id ?? '')
