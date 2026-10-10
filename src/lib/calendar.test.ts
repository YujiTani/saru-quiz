import { describe, expect, it } from 'vitest'
import { addMonth, cmpMonth, dayKeyOf, fmtDay, monthCells, monthLayout } from './calendar'

describe('えにっきの月の並び', () => {
  it('その月の最初の日の曜日（0=にち）と日数', () => {
    expect(monthLayout(2026, 10)).toEqual({ startDow: 4, days: 31 }) // 2026-10-01 は木曜
    expect(monthLayout(2026, 2)).toEqual({ startDow: 0, days: 28 }) // 2026-02-01 は日曜
    expect(monthLayout(2024, 2)).toEqual({ startDow: 4, days: 29 }) // うるう年
    expect(monthLayout(2026, 11)).toEqual({ startDow: 0, days: 30 })
    expect(monthLayout(2025, 3)).toEqual({ startDow: 6, days: 31 }) // 土曜はじまり
  })

  it('マスは 先頭の空き＋日にち＋おしりの空き。7の倍数', () => {
    const c = monthCells(2026, 10)
    expect(c.length % 7).toBe(0)
    expect(c.slice(0, 4)).toEqual([null, null, null, null])
    expect(c[4]).toBe(1)
    expect(c.filter((d) => d !== null)).toHaveLength(31)
    expect(c.filter((d) => d !== null).at(-1)).toBe(31)
    // ちょうど4週ぶん（日曜はじまりで28日の月）には空きがない
    expect(monthCells(2026, 2)).toHaveLength(28)
    expect(monthCells(2026, 2).includes(null)).toBe(false)
  })

  it('月をずらす（年をまたぐ）', () => {
    expect(addMonth({ y: 2026, m: 1 }, -1)).toEqual({ y: 2025, m: 12 })
    expect(addMonth({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 })
    expect(addMonth({ y: 2026, m: 10 }, -12)).toEqual({ y: 2025, m: 10 })
    expect(addMonth({ y: 2026, m: 10 }, 0)).toEqual({ y: 2026, m: 10 })
  })

  it('月の前後の比べ方', () => {
    expect(cmpMonth({ y: 2026, m: 10 }, { y: 2026, m: 10 })).toBe(0)
    expect(cmpMonth({ y: 2026, m: 11 }, { y: 2026, m: 10 })).toBeGreaterThan(0)
    expect(cmpMonth({ y: 2025, m: 12 }, { y: 2026, m: 1 })).toBeLessThan(0)
  })

  it('日付キーと表示', () => {
    expect(dayKeyOf(2026, 3, 5)).toBe('2026-03-05')
    expect(fmtDay('2026-10-11')).toBe('10がつ 11にち')
    expect(fmtDay('2026-01-05')).toBe('1がつ 5にち')
  })
})
