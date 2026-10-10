import { describe, expect, it } from 'vitest'
import { hashSeed, mulberry32, rng, seeded, setSeed } from './rng'

const take = (f: () => number, n: number) => Array.from({ length: n }, f)

describe('rng', () => {
  it('同じシードなら同じ並び、ちがうシードなら別の並び', () => {
    expect(take(mulberry32(1), 5)).toEqual(take(mulberry32(1), 5))
    expect(take(mulberry32(1), 5)).not.toEqual(take(mulberry32(2), 5))
  })

  it('0以上1未満', () => {
    for (const v of take(mulberry32(42), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('setSeed で rng() が固定される', () => {
    setSeed(7)
    const a = take(rng, 5)
    setSeed(7)
    expect(take(rng, 5)).toEqual(a)
  })

  it('hashSeed は文字列で決まる', () => {
    expect(hashSeed('2026-01-01')).toBe(hashSeed('2026-01-01'))
    expect(hashSeed('2026-01-01')).not.toBe(hashSeed('2026-01-02'))
  })

  it('seeded は独立した乱数（片方を進めても影響しない）', () => {
    const a = seeded('x')
    const b = seeded('x')
    a()
    a()
    expect(take(b, 3)).toEqual(take(seeded('x'), 3))
  })
})
