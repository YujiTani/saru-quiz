// 乱数。?seed=数値 があれば固定して同じ結果を再現できる（テスト・演出の確認用）
export type Rng = () => number

/** mulberry32: 小さくて速い、シード付きの乱数 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 文字列（日付など）から数値のシードを作る（FNV-1a） */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 文字列ごとに独立した乱数（同じ文字列なら毎回同じ並び） */
export const seeded = (str: string): Rng => mulberry32(hashSeed(str))

const seedParam = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('seed')
let gen: Rng = seedParam !== null && seedParam !== '' && Number.isFinite(Number(seedParam)) ? mulberry32(Number(seedParam)) : Math.random

/** ふだんは Math.random と同じ。?seed があれば固定 */
export const rng: Rng = () => gen()
export function setSeed(n: number) {
  gen = mulberry32(n)
}
