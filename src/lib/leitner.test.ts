import { describe, expect, it } from 'vitest'
import { applyAnswer, boxOf, INTERVAL_DAYS, isCloudy, migrate, weight } from './leitner'
import type { WordStat } from './storage'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const day = (n: number, h = 12) => at(2026, 1, 1 + n, h)
const fresh: WordStat = { ok: 0, ng: 0, last: 0 }

/** 日ごとに最初の答えで正解し続ける */
function climb(days: number[], start: WordStat = fresh) {
  let stat = start
  for (const d of days) stat = applyAnswer(stat, true, day(d)).stat
  return stat
}

describe('leitner 段の上がり方', () => {
  it('段0 → 1 は同じ日でもよい（0日）', () => {
    const r = applyAnswer(fresh, true, day(0))
    expect(r.stat.box).toBe(1)
    expect(r.events).toEqual({ mastered: true, starUp: 1, polished: false })
    expect(r.stat.firstOkAt).toBe(day(0))
  })

  it('同じ日に2段は上がらない', () => {
    const a = applyAnswer(fresh, true, day(0, 9)).stat
    const b = applyAnswer(a, true, day(0, 20))
    expect(b.stat.box).toBe(1)
    expect(b.events.starUp).toBeNull()
  })

  it('決まった日数がたったら上がる（0,1,3,7,14日）', () => {
    // 段ごとの最短: 0日 → 1日 → 3日 → 7日 → 14日
    const days = [0, 0, 1, 4, 11, 25]
    const stat = climb(days)
    expect(stat.box).toBe(5)
    expect(INTERVAL_DAYS).toEqual([0, 1, 3, 7, 14])
  })

  it('日数が足りないと上がらない', () => {
    expect(climb([0, 1]).box).toBe(2)
    expect(climb([0, 1, 3]).box).toBe(2) // 段2→3 は前回(1日目)から3日後の4日目から
    expect(climb([0, 1, 4]).box).toBe(3)
    expect(climb([0, 1, 4, 10]).box).toBe(3) // 段3→4 は4日目から7日後の11日目から
    expect(climb([0, 1, 4, 11]).box).toBe(4)
  })

  it('最高は5', () => {
    const stat = climb([0, 1, 4, 11, 25, 60, 100])
    expect(stat.box).toBe(5)
  })

  it('まちがえても段は下がらない。due は今に戻る', () => {
    const up = climb([0, 1, 4])
    expect(up.box).toBe(3)
    const r = applyAnswer(up, false, day(5))
    expect(r.stat.box).toBe(3)
    expect(r.stat.due).toBe(day(5))
    expect(r.events).toEqual({ mastered: false, starUp: null, polished: false })
  })

  it('まちがえたあとも boxAt は変わらないので、日数がたてば正解で上がる', () => {
    const up = climb([0, 1, 4]) // 段3、boxAt は4日目
    const miss = applyAnswer(up, false, day(9)).stat
    expect(applyAnswer(miss, true, day(10)).stat.box).toBe(3) // 4日目から6日後ではまだ
    expect(applyAnswer(miss, true, day(11)).stat.box).toBe(4)
  })

  it('早すぎる正解では、まちがいで戻した due をもとの予定に戻す', () => {
    const up = climb([0, 1]) // 段2、boxAt は1日目
    const miss = applyAnswer(up, false, day(2)).stat
    const ok = applyAnswer(miss, true, day(3)).stat
    expect(ok.box).toBe(2)
    expect(ok.due).toBe(up.due)
  })
})

describe('leitner くもり・みがく', () => {
  it('due + 猶予をすぎるとくもり。段0はくもらない', () => {
    const s = climb([0, 1, 4]) // 段3: due は 4日目+7日 = 11日目、猶予4日
    expect(isCloudy(s, day(11))).toBe(false)
    expect(isCloudy(s, day(15))).toBe(false)
    expect(isCloudy(s, day(16))).toBe(true)
    expect(isCloudy({ ok: 1, ng: 0, last: 1, box: 0, due: 0 }, day(100))).toBe(false)
    expect(isCloudy(undefined, day(100))).toBe(false)
  })

  it('くもりを最初の答えで正解すると、段は保ったまま「みがいた」', () => {
    const s = climb([0, 1, 4])
    const r = applyAnswer(s, true, day(30))
    expect(r.stat.box).toBe(3)
    expect(r.events).toEqual({ mastered: false, starUp: null, polished: true })
    expect(isCloudy(r.stat, day(30))).toBe(false)
    // みがいた直後に同じ日にもう一度正解しても、段は上がらない
    expect(applyAnswer(r.stat, true, day(30, 20)).stat.box).toBe(3)
    // 次の機会（日数がたったあと）に上がる
    expect(applyAnswer(r.stat, true, day(38)).stat.box).toBe(4)
  })

  it('くもりのときのまちがいでも段は下がらない', () => {
    const s = climb([0, 1, 4])
    const r = applyAnswer(s, false, day(30))
    expect(r.stat.box).toBe(3)
    expect(r.events.polished).toBe(false)
  })
})

describe('leitner 移しかえ', () => {
  it('ok>=3 かつ ng<ok なら段1、ほかは段0', () => {
    expect(migrate({ ok: 3, ng: 2, last: day(0) }).box).toBe(1)
    expect(migrate({ ok: 3, ng: 3, last: day(0) }).box).toBe(0)
    expect(migrate({ ok: 2, ng: 0, last: day(0) }).box).toBe(0)
    expect(migrate(fresh).box).toBe(0)
  })

  it('すでに段があるものは変えない', () => {
    const s: WordStat = { ok: 9, ng: 0, last: 1, box: 4, boxAt: 1, due: 2 }
    expect(migrate(s)).toBe(s)
  })

  it('移しかえた段1は ok/ng の数え直しなしで☆になる', () => {
    expect(boxOf({ ok: 5, ng: 1, last: day(0) })).toBe(1)
    expect(boxOf(undefined)).toBe(0)
  })

  it('移しかえた段1から、1日後の正解で段2', () => {
    const old: WordStat = { ok: 4, ng: 0, last: day(0) }
    expect(applyAnswer(old, true, day(0, 20)).stat.box).toBe(1)
    expect(applyAnswer(old, true, day(1)).stat.box).toBe(2)
  })
})

describe('leitner 重み', () => {
  it('くもりが重く、覚えたばかりは軽い', () => {
    const fine = climb([0]) // 段1、due は翌日
    const cloudy = climb([0, 1, 4])
    expect(weight(undefined, day(0))).toBe(3)
    expect(weight(fine, day(0))).toBeLessThan(weight(fresh, day(0)))
    expect(weight(cloudy, day(30))).toBeGreaterThan(weight(fine, day(0)))
    expect(weight({ ...fresh, ng: 2 }, day(0))).toBeGreaterThan(weight(fresh, day(0)))
  })
})
