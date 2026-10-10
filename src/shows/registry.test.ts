import { describe, expect, it } from 'vitest'
import { BANANA_STAGES } from '../lib/banana'
import { categories } from '../lib/quiz'
import { seeded } from '../lib/rng'
import { SHOWS, getShow, isUnlocked, ownedIn, pickShow, ugokuFor } from './registry'
import type { UnlockCtx } from './types'

const u0: UnlockCtx = { masteredTotal: 0, masteredByCat: {}, starsTotal: 0, playDays: 0, plays: 0, clears: 0, polishedTotal: 0, seen: {}, coins: 0 }
const withU = (p: Partial<UnlockCtx>): UnlockCtx => ({ ...u0, ...p })
const ids = (l: { id: string }[]) => l.map((s) => s.id)

describe('登録された演出', () => {
  it('id がかさならず、名前はひらがな・カタカナ・記号だけ', () => {
    expect(new Set(ids(SHOWS)).size).toBe(SHOWS.length)
    for (const s of SHOWS) expect(s.name).toMatch(/^[ぁ-んァ-ヶー 　]+$/u)
  })

  it('うごくえの forCat は実在するカテゴリ名で、かさならない', () => {
    const names = new Set(categories.map((c) => c.name))
    const ug = SHOWS.filter((s) => s.cat === 'ugoku' && s.forCat)
    expect(ug).toHaveLength(8)
    for (const s of ug) expect(names.has(s.forCat!), s.id).toBe(true)
    expect(new Set(ug.map((s) => s.forCat)).size).toBe(8)
    for (const s of ug) expect(s.hint).toContain('3つ')
  })

  it('ずっこけは4種類。slip と hakushon は はじめから', () => {
    const zk = SHOWS.filter((s) => s.cat === 'zukkoke')
    expect(ids(zk).sort()).toEqual(['zukkoke:guruguru', 'zukkoke:hakushon', 'zukkoke:hiyoko', 'zukkoke:slip'])
    expect(getShow('zukkoke:slip')?.base).toBe(true)
    expect(getShow('zukkoke:hakushon')?.base).toBe(true)
  })
})

describe('isUnlocked / ownedIn', () => {
  it('base は条件なしで持っている', () => {
    expect(isUnlocked(getShow('ugoku:pika')!, u0)).toBe(true)
  })

  it('unlock の条件をみたすと持っている', () => {
    const s = getShow('zukkoke:guruguru')!
    expect(isUnlocked(s, withU({ playDays: 1 }))).toBe(false)
    expect(isUnlocked(s, withU({ playDays: 2 }))).toBe(true)
    const h = getShow('zukkoke:hiyoko')!
    expect(isUnlocked(h, withU({ playDays: 3 }))).toBe(false)
    expect(isUnlocked(h, withU({ playDays: 4 }))).toBe(true)
  })

  it('base も unlock もないものは持っていない', () => {
    expect(isUnlocked({ id: 'x', cat: 'ouen', name: 'x', icon: 'x', play: () => {} }, u0)).toBe(false)
  })

  it('ownedIn はそのカテゴリで持っているものだけ', () => {
    expect(ids(ownedIn('zukkoke', u0)).sort()).toEqual(['zukkoke:hakushon', 'zukkoke:slip'])
    expect(ids(ownedIn('zukkoke', withU({ playDays: 9 })))).toHaveLength(4)
    expect(ownedIn('ouen', u0)).toEqual([])
  })
})

describe('pickShow', () => {
  it('固定していて持っていれば、それを使う', () => {
    const u = withU({ playDays: 5 })
    for (let i = 0; i < 20; i++) expect(pickShow('zukkoke', { zukkoke: 'zukkoke:hiyoko' }, u, seeded(String(i)))?.id).toBe('zukkoke:hiyoko')
  })

  it('固定していても まだ持っていなければ無視して、持っているものから選ぶ', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(pickShow('zukkoke', { zukkoke: 'zukkoke:hiyoko' }, u0, seeded(String(i)))!.id)
    expect(seen.has('zukkoke:hiyoko')).toBe(false)
    expect([...seen].sort()).toEqual(['zukkoke:hakushon', 'zukkoke:slip'])
  })

  it('別のカテゴリの id を固定していても使わない', () => {
    expect(pickShow('zukkoke', { zukkoke: 'ugoku:pika' }, u0, () => 0)?.cat).toBe('zukkoke')
  })

  it("'auto' と未設定は、乱数で持っているものから選ぶ", () => {
    const owned = ownedIn('zukkoke', u0)
    expect(pickShow('zukkoke', { zukkoke: 'auto' }, u0, () => 0)).toBe(owned[0])
    expect(pickShow('zukkoke', {}, u0, () => 0.999)).toBe(owned[owned.length - 1])
  })

  it('持っているものがなければ undefined', () => {
    expect(pickShow('ouen', {}, u0, () => 0)).toBeUndefined()
  })

  it('ずっこけは直前と同じものが続かない', () => {
    for (const u of [u0, withU({ playDays: 2 }), withU({ playDays: 9 })]) {
      const rng = seeded('zk')
      let last: string | undefined
      for (let i = 0; i < 300; i++) {
        const s = pickShow('zukkoke', {}, u, rng, last)!
        expect(s.id).not.toBe(last)
        last = s.id
      }
    }
  })

  it('持っているのが1つだけなら、同じものでも選ぶ', () => {
    // うごくえ pika だけ
    const only = pickShow('ugoku', {}, u0, () => 0, 'ugoku:pika')
    expect(only?.id).toBe('ugoku:pika')
  })
})

describe('ugokuFor', () => {
  it('そのカテゴリを3つおぼえたら専用のうごくえ', () => {
    expect(ugokuFor('どうぶつ', withU({ masteredByCat: { どうぶつ: 3 } })).id).toBe('ugoku:doubutsu')
    expect(ugokuFor('のりもの', withU({ masteredByCat: { のりもの: 5 } })).id).toBe('ugoku:norimono')
    expect(ugokuFor('くだもの', withU({ masteredByCat: { くだもの: 3 } })).id).toBe('ugoku:kudamono')
  })

  it('3つに届かない・ほかのカテゴリなら基本の ぴかっ', () => {
    expect(ugokuFor('どうぶつ', withU({ masteredByCat: { どうぶつ: 2 } })).id).toBe('ugoku:pika')
    expect(ugokuFor('どうぶつ', withU({ masteredByCat: { とり: 9 } })).id).toBe('ugoku:pika')
    expect(ugokuFor('かたち', withU({ masteredByCat: { かたち: 9 } })).id).toBe('ugoku:pika')
  })

  it('8カテゴリそれぞれに専用のうごくえがある', () => {
    const cats = ['どうぶつ', 'とり', 'うみのいきもの', 'むし', 'のりもの', 'くだもの', 'やさい', 'たべもの']
    const got = cats.map((c) => ugokuFor(c, withU({ masteredByCat: { [c]: 3 } })).id)
    expect(new Set(got).size).toBe(8)
    expect(got).not.toContain('ugoku:pika')
  })
})

describe('バナナのやま（banana:*）', () => {
  const bs = () => SHOWS.filter((s) => s.cat === 'banana')

  it('7段階。ひとふさは はじめから、あとは 合計バナナで手に入る', () => {
    expect(ids(bs())).toEqual(BANANA_STAGES.map((s) => `banana:${s.id}`))
    expect(getShow('banana:fusa')?.base).toBe(true)
    expect(ids(ownedIn('banana', u0))).toEqual(['banana:fusa'])
  })

  it('しきい値ちょうどで手に入る。ひとつ前までは持っていない', () => {
    BANANA_STAGES.slice(1).forEach((st, k) => {
      const s = getShow(`banana:${st.id}`)!
      expect(isUnlocked(s, withU({ coins: st.need - 1 })), st.id).toBe(false)
      expect(isUnlocked(s, withU({ coins: st.need })), st.id).toBe(true)
      expect(ownedIn('banana', withU({ coins: st.need })), `${k}`).toHaveLength(k + 2)
    })
  })

  it('親向けの説明にバナナの数が入る', () => {
    for (const st of BANANA_STAGES.slice(1)) expect(getShow(`banana:${st.id}`)!.hint).toContain(String(st.need))
  })
})

describe('ふぃなーれ（finale:*）', () => {
  it('きねんしゃしんは はじめから。pickShow で選べる', () => {
    const s = getShow('finale:photo')!
    expect(s.cat).toBe('finale')
    expect(s.base).toBe(true)
    expect(pickShow('finale', {}, u0, seeded('1'))?.id).toBe('finale:photo')
  })
})
