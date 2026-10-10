import { describe, expect, it } from 'vitest'
import { BOOK_CATS, bookCounts, grantShows, isOwned, newlyUnlocked, showsOf } from './book'
import { SHOWS } from './registry'
import type { Show, UnlockCtx } from './types'

const u0: UnlockCtx = { masteredTotal: 0, masteredByCat: {}, starsTotal: 0, playDays: 0, plays: 0, clears: 0, polishedTotal: 0, seen: {}, coins: 0 }
const withU = (p: Partial<UnlockCtx>): UnlockCtx => ({ ...u0, ...p })
const play = () => {}
// 小さな登録で試す
const base: Show = { id: 'a:base', cat: 'ugoku', name: 'はじめから', icon: '✨', base: true, play }
const two: Show = { id: 'a:two', cat: 'ugoku', name: 'にかい', icon: '2', unlock: (u) => u.plays >= 2, play }
const five: Show = { id: 'a:five', cat: 'zukkoke', name: 'ごかい', icon: '5', unlock: (u) => u.plays >= 5, play }
const hap: Show = { id: 'h:ufo', cat: 'happening', name: 'ゆーふぉー', icon: '🛸', play }
const FAKE = [base, two, five, hap]

describe('newlyUnlocked', () => {
  it('前に持っていなくて、あとで持っているものだけ（登録の順）', () => {
    expect(newlyUnlocked(withU({ plays: 1 }), withU({ plays: 2 }), FAKE)).toEqual(['a:two'])
    expect(newlyUnlocked(withU({ plays: 1 }), withU({ plays: 6 }), FAKE)).toEqual(['a:two', 'a:five'])
  })

  it('変わらなければ空。はじめから持っているもの（base）は出さない', () => {
    expect(newlyUnlocked(withU({ plays: 3 }), withU({ plays: 3 }), FAKE)).toEqual([])
    expect(newlyUnlocked(u0, u0, FAKE)).toEqual([])
  })

  it('もう持っているものは、条件をこえても また出さない', () => {
    expect(newlyUnlocked(withU({ plays: 2 }), withU({ plays: 9 }), FAKE)).toEqual(['a:five'])
  })

  it('ハプニングは「みつけた」とき', () => {
    expect(newlyUnlocked(u0, withU({ seen: { 'h:ufo': 1 } }), FAKE)).toEqual(['h:ufo'])
  })

  it('本物の登録でも、条件ぴったりで1つだけ新しくなる（ずっこけ ぐるぐる = 2日）', () => {
    expect(newlyUnlocked(withU({ playDays: 1 }), withU({ playDays: 2 }))).toEqual(['zukkoke:guruguru'])
  })
})

describe('grantShows（手に入れた記録）', () => {
  it('はじめて: base（と、すでに持っていたもの）をまとめて got に入れる。newShows には出さない', () => {
    const r = grantShows({}, withU({ plays: 2 }), withU({ plays: 2 }), 1000, FAKE)
    expect(r.got).toEqual({ 'a:base': 1000, 'a:two': 1000 })
    expect(r.newShows).toEqual([])
  })

  it('新しく手に入れたものは、got に時刻が入って newShows に出る。前の記録は変えない', () => {
    const r = grantShows({ 'a:base': 1, 'a:two': 2 }, withU({ plays: 4 }), withU({ plays: 5 }), 9000, FAKE)
    expect(r.newShows).toEqual(['a:five'])
    expect(r.got).toEqual({ 'a:base': 1, 'a:two': 2, 'a:five': 9000 })
  })

  it('同じことを2回しても、1回目の時刻のまま・newShows は空', () => {
    const first = grantShows({}, u0, withU({ plays: 6 }), 100, FAKE)
    expect(first.newShows).toEqual(['a:two', 'a:five'])
    const second = grantShows(first.got, withU({ plays: 6 }), withU({ plays: 7 }), 200, FAKE)
    expect(second.got).toEqual(first.got)
    expect(second.newShows).toEqual([])
  })

  it('元の got を書きかえない', () => {
    const got = { 'a:base': 1 }
    grantShows(got, u0, withU({ plays: 2 }), 5, FAKE)
    expect(got).toEqual({ 'a:base': 1 })
  })
})

describe('isOwned', () => {
  it('got にあれば（条件をみたしていなくても）手に入れた扱い。一度手に入れたものは なくならない', () => {
    expect(isOwned(five, u0)).toBe(false)
    expect(isOwned(five, u0, { 'a:five': 1 })).toBe(true)
  })
})

describe('bookCounts', () => {
  it('カテゴリごとの「手に入れた数 / 全部」と、全体', () => {
    const c = bookCounts(withU({ plays: 2 }), {}, FAKE)
    expect(c.all).toEqual({ got: 2, total: 4 })
    expect(c.byCat.ugoku).toEqual({ got: 2, total: 2 })
    expect(c.byCat.zukkoke).toEqual({ got: 0, total: 1 })
    expect(c.byCat.happening).toEqual({ got: 0, total: 1 })
    expect(c.byCat.deteku).toEqual({ got: 0, total: 0 })
    expect(bookCounts(withU({ plays: 5, seen: { 'h:ufo': 1 } }), {}, FAKE).all).toEqual({ got: 4, total: 4 })
  })

  it('本物の登録: 全タブが数えられ、合計がぴったり合う', () => {
    expect(BOOK_CATS.map((c) => c.cat)).toEqual(['ugoku', 'michi', 'ongaku', 'zukkoke', 'deteku', 'ouen', 'finale', 'happening', 'banana'])
    const c = bookCounts(u0)
    expect(c.all.total).toBe(SHOWS.length)
    expect(Object.values(c.byCat).reduce((n, x) => n + x.total, 0)).toBe(SHOWS.length)
    expect(Object.values(c.byCat).reduce((n, x) => n + x.got, 0)).toBe(c.all.got)
    expect(c.byCat.ugoku.total).toBe(22)
    expect(c.byCat.zukkoke.total).toBe(8)
    // はじめから持っているもの: ぴかっ・つるん・はくしょん・じゃんぐる・ジャングルマーチ・きねんしゃしん・ひとふさ
    expect(c.all.got).toBe(SHOWS.filter((s) => s.base).length)
  })

  it('showsOf はカテゴリの演出を登録の順に', () => {
    expect(showsOf('ugoku', FAKE).map((s) => s.id)).toEqual(['a:base', 'a:two'])
    expect(showsOf('ouen', FAKE)).toEqual([])
  })
})
