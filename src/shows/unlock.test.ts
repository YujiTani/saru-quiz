import { describe, expect, it } from 'vitest'
import { emptySave, type Save } from '../lib/storage'
import { unlockCtx } from './unlock'

const CAT: Record<string, string> = { a: 'どうぶつ', b: 'どうぶつ', c: 'とり', d: 'とり' }
const catOf = (id: string) => CAT[id]
const stat = (box: number) => ({ ok: 1, ng: 0, last: 1000, box })

describe('unlockCtx', () => {
  it('空のデータは全部ゼロ', () => {
    const u = unlockCtx(emptySave(), 0, catOf)
    expect(u).toEqual({ masteredTotal: 0, masteredByCat: {}, starsTotal: 0, playDays: 0, plays: 0, clears: 0, polishedTotal: 0, seen: {}, coins: 0 })
  })

  it('おぼえた数（☆1以上）をカテゴリごとに数える。箱0は数えない', () => {
    const save: Save = { ...emptySave(), stats: { a: stat(1), b: stat(3), c: stat(0), d: stat(5) } }
    const u = unlockCtx(save, 0, catOf)
    expect(u.masteredTotal).toBe(3)
    expect(u.masteredByCat).toEqual({ どうぶつ: 2, とり: 1 })
    expect(u.starsTotal).toBe(9)
  })

  it('箱がない古いデータも移しかえて数える（3回以上正解してまちがいが少ない）', () => {
    const save: Save = { ...emptySave(), stats: { a: { ok: 3, ng: 0, last: 1000 }, b: { ok: 1, ng: 0, last: 1000 } } }
    const u = unlockCtx(save, 0, catOf)
    expect(u.masteredTotal).toBe(1)
    expect(u.masteredByCat).toEqual({ どうぶつ: 1 })
  })

  it('カテゴリが分からない単語は合計だけに入る', () => {
    const save: Save = { ...emptySave(), stats: { zzz: stat(2) } }
    const u = unlockCtx(save, 0, catOf)
    expect(u.masteredTotal).toBe(1)
    expect(u.masteredByCat).toEqual({})
  })

  it('遊んだ日・回数・クリア数・見たハプニング', () => {
    const save: Save = {
      ...emptySave(),
      plays: 7,
      cleared: [1, 2],
      diary: { '2026-10-01': { words: ['a'], plays: 1 }, '2026-10-05': { words: ['b'], plays: 2 } },
      shows: { got: {}, seen: { ufo: 123 }, pick: {} },
    }
    const u = unlockCtx(save, 0, catOf)
    expect(u.playDays).toBe(2)
    expect(u.plays).toBe(7)
    expect(u.clears).toBe(2)
    expect(u.seen).toEqual({ ufo: 123 })
    expect(unlockCtx({ ...save, coins: 777 }, 0, catOf).coins).toBe(777) // バナナのやま
  })
})
