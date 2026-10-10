import { afterEach, describe, expect, it } from 'vitest'
import { dayKey, daysBetween, now, setNow } from './day'

// 端末の時刻に左右されないよう、ローカル時刻で日時を作る
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

afterEach(() => setNow())

describe('day', () => {
  it('dayKey はローカルの日付', () => {
    expect(dayKey(at(2026, 3, 5))).toBe('2026-03-05')
    expect(dayKey(at(2026, 12, 31, 23))).toBe('2026-12-31')
    expect(dayKey(at(2027, 1, 1, 0))).toBe('2027-01-01')
  })

  it('daysBetween は暦の日で数える（時刻は関係ない）', () => {
    expect(daysBetween(at(2026, 1, 1, 23), at(2026, 1, 2, 1))).toBe(1)
    expect(daysBetween(at(2026, 1, 1, 1), at(2026, 1, 1, 23))).toBe(0)
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3)
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3)
    expect(daysBetween('2026-01-05', '2026-01-01')).toBe(-4)
  })

  it('setNow で今の時刻を差しかえられる', () => {
    setNow(() => at(2030, 5, 5))
    expect(dayKey(now())).toBe('2030-05-05')
    setNow()
    expect(Math.abs(now() - Date.now())).toBeLessThan(1000)
  })
})
