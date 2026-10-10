import { describe, expect, it } from 'vitest'
import { reachFor, shouldAnnounce } from './reach'

describe('reachFor（のこり数 → 出すもの）', () => {
  it('のこり4問以上は何も出さない', () => {
    for (const n of [4, 5, 10, 50]) expect(reachFor(n)).toEqual({ crowd: 0, keyUp: 0, bigPic: false })
  })

  it('のこり3問: あと3もん！・ドラムロール・半音上げ・おさる3匹', () => {
    const r = reachFor(3)
    expect(r.announce).toEqual({ banner: 'あと3もん！', speech: 'あと、3もん！', drumroll: true })
    expect(r.keyUp).toBe(1)
    expect(r.crowd).toBe(3)
    expect(r.bigPic).toBe(false)
  })

  it('のこり2問: お知らせはなし。おさるは4匹、半音上げはそのまま', () => {
    const r = reachFor(2)
    expect(r.announce).toBeUndefined()
    expect(r.crowd).toBe(4)
    expect(r.keyUp).toBe(1)
  })

  it('のこり1問: ラスト！・おさる5匹・絵を大きく', () => {
    const r = reachFor(1)
    expect(r.announce?.speech).toBe('ラスト！')
    expect(r.announce?.banner).toBe('ラスト！')
    expect(r.crowd).toBe(5)
    expect(r.bigPic).toBe(true)
    expect(r.keyUp).toBe(1)
  })

  it('クリア（のこり0以下）では何も出さない（ぷはーっ！は Quiz が出す）', () => {
    expect(reachFor(0)).toEqual({ crowd: 0, keyUp: 0, bigPic: false })
    expect(reachFor(-1).crowd).toBe(0)
  })

  it('おさるは 3〜5匹', () => {
    for (const n of [3, 2, 1]) {
      expect(reachFor(n).crowd).toBeGreaterThanOrEqual(3)
      expect(reachFor(n).crowd).toBeLessThanOrEqual(5)
    }
  })

  it('のこり数が減るほど おさるは増える', () => {
    expect(reachFor(3).crowd).toBeLessThan(reachFor(2).crowd)
    expect(reachFor(2).crowd).toBeLessThan(reachFor(1).crowd)
  })
})

describe('shouldAnnounce（1回だけ）', () => {
  it('のこり3問・1問になった瞬間に出す。2問や4問以上では出さない', () => {
    const done = new Set<number>()
    expect(shouldAnnounce(4, done)).toBe(false)
    expect(shouldAnnounce(3, done)).toBe(true)
    expect(shouldAnnounce(2, done)).toBe(false)
    expect(shouldAnnounce(1, done)).toBe(true)
    expect(shouldAnnounce(0, done)).toBe(false)
  })

  it('いちど出したら、まちがえて同じ問題がつづいても出さない', () => {
    const done = new Set<number>([3])
    expect(shouldAnnounce(3, done)).toBe(false)
    expect(shouldAnnounce(1, done)).toBe(true)
    done.add(1)
    expect(shouldAnnounce(1, done)).toBe(false)
  })

  it('?goal=3 のように最初からのこり3問なら、はじめに1回だけ', () => {
    const done = new Set<number>()
    const remaining = 3 - 0
    expect(shouldAnnounce(remaining, done)).toBe(true)
    done.add(remaining)
    expect(shouldAnnounce(remaining, done)).toBe(false)
    // 1問あてて のこり2 → お知らせなし、もう1問で のこり1 → ラスト！
    expect(shouldAnnounce(2, done)).toBe(false)
    expect(shouldAnnounce(1, done)).toBe(true)
  })
})
