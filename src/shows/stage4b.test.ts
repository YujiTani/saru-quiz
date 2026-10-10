// 段階4b: でてくる・おうえん・ふぃなーれの残り・ハプニングの 登録・解放・選びかた・確率
import { describe, expect, it } from 'vitest'
import { dayKey } from '../lib/day'
import voiceLines from '../../scripts/voice_lines.py?raw'
import { applyResult } from '../lib/progress'
import { emptySave } from '../lib/storage'
import type { QuizResult } from '../screens/Quiz'
import { HAP_MAX, HAPPENING_SHOWS } from './happening'
import { HAP_AT_MAX, forcedPlan, hapChance, planHappening } from './hapPlan'
import { BIRD_MAX, CHEER_SLOTS, birdCount, cheerSlot, nakamaItems, osaruCount } from './ouen'
import { DETEKU_MS } from './deteku'
import { PARADE_MAX, paradeMs } from './finaleMore'
import { SHOWS, finaleLimit, getShow, isUnlocked, ownedIn, pickShow } from './registry'
import { bookCounts, showsOf } from './book'
import type { UnlockCtx } from './types'

const u0: UnlockCtx = { masteredTotal: 0, masteredByCat: {}, starsTotal: 0, playDays: 0, plays: 0, clears: 0, polishedTotal: 0, seen: {}, coins: 0 }
const withU = (p: Partial<UnlockCtx>): UnlockCtx => ({ ...u0, ...p })
const ids = (l: { id: string }[]) => l.map((s) => s.id)
const HAP = ids(HAPPENING_SHOWS)

describe('登録の数と id', () => {
  it('でてくる5・おうえん3・ふぃなーれ4・ハプニング10', () => {
    expect(ids(showsOf('deteku'))).toEqual(['deteku:baa', 'deteku:present', 'deteku:ki', 'deteku:shabon', 'deteku:tsuchi'])
    expect(ids(showsOf('ouen'))).toEqual(['ouen:nakama', 'ouen:osaru', 'ouen:kotori'])
    expect(ids(showsOf('finale'))).toEqual(['finale:photo', 'finale:parade', 'finale:bananatree', 'finale:rocket'])
    expect(HAP).toEqual(['hap:ufo', 'hap:kirin', 'hap:kisha', 'hap:niji', 'hap:obake', 'hap:mochi', 'hap:kujira', 'hap:hato', 'hap:fusen', 'hap:nagareboshi'])
    expect(showsOf('happening')).toHaveLength(10)
  })

  it('ずかんの集計: ハプニングは まだ0 / みつけたら増える', () => {
    expect(bookCounts(u0).byCat.happening).toEqual({ got: 0, total: 10 })
    expect(bookCounts(withU({ seen: { 'hap:ufo': 1, 'hap:niji': 2 } })).byCat.happening).toEqual({ got: 2, total: 10 })
    expect(bookCounts(u0).byCat.deteku.total).toBe(5)
  })
})

describe('解放条件', () => {
  const ok = (id: string, u: UnlockCtx) => isUnlocked(getShow(id)!, u)

  it('はじめから: いないいないばあ・きょうのなかま', () => {
    expect(ids(ownedIn('deteku', u0))).toEqual(['deteku:baa'])
    expect(ids(ownedIn('ouen', u0))).toEqual(['ouen:nakama'])
  })

  it('でてくる: プレゼント plays>=3 / き playDays>=3 / しゃぼん clears>=1 / つち masteredTotal>=10（ぴったりで開く）', () => {
    expect([ok('deteku:present', withU({ plays: 2 })), ok('deteku:present', withU({ plays: 3 }))]).toEqual([false, true])
    expect([ok('deteku:ki', withU({ playDays: 2 })), ok('deteku:ki', withU({ playDays: 3 }))]).toEqual([false, true])
    expect([ok('deteku:shabon', u0), ok('deteku:shabon', withU({ clears: 1 }))]).toEqual([false, true])
    expect([ok('deteku:tsuchi', withU({ masteredTotal: 9 })), ok('deteku:tsuchi', withU({ masteredTotal: 10 }))]).toEqual([false, true])
  })

  it('おうえん: おさる masteredTotal>=20 / ことり とり5語', () => {
    expect([ok('ouen:osaru', withU({ masteredTotal: 19 })), ok('ouen:osaru', withU({ masteredTotal: 20 }))]).toEqual([false, true])
    expect(ok('ouen:kotori', withU({ masteredTotal: 99, masteredByCat: { どうぶつ: 9 } }))).toBe(false)
    expect(ok('ouen:kotori', withU({ masteredByCat: { とり: 4 } }))).toBe(false)
    expect(ok('ouen:kotori', withU({ masteredByCat: { とり: 5 } }))).toBe(true)
  })

  it('ふぃなーれ: パレード clears>=2 / バナナのき coins>=1500 / ロケット clears>=5', () => {
    expect([ok('finale:parade', withU({ clears: 1 })), ok('finale:parade', withU({ clears: 2 }))]).toEqual([false, true])
    expect([ok('finale:bananatree', withU({ coins: 1499 })), ok('finale:bananatree', withU({ coins: 1500 }))]).toEqual([false, true])
    expect([ok('finale:rocket', withU({ clears: 4 })), ok('finale:rocket', withU({ clears: 5 }))]).toEqual([false, true])
  })

  it('ハプニングは解放条件では持てない（見たら）', () => {
    for (const id of HAP) expect(ok(id, withU({ plays: 99, playDays: 99, clears: 99, masteredTotal: 999 }))).toBe(false)
  })
})

describe('選びかた（でてくる・おうえん）', () => {
  it('はじめは1つだけ。ふえたら おまかせで どれでも / こていなら それ', () => {
    expect(pickShow('deteku', {}, u0, () => 0.9)?.id).toBe('deteku:baa')
    const u = withU({ plays: 3, playDays: 3, clears: 1, masteredTotal: 10 })
    expect(ids(ownedIn('deteku', u))).toHaveLength(5)
    expect(pickShow('deteku', {}, u, () => 0.999)?.id).toBe('deteku:tsuchi')
    expect(pickShow('deteku', { deteku: 'deteku:ki' }, u, () => 0)?.id).toBe('deteku:ki')
    expect(pickShow('deteku', { deteku: 'auto' }, u, () => 0)?.id).toBe('deteku:baa')
    // まだ持っていない固定は無視
    expect(pickShow('ouen', { ouen: 'ouen:kotori' }, u0, () => 0)?.id).toBe('ouen:nakama')
    expect(pickShow('ouen', { ouen: 'ouen:osaru' }, withU({ masteredTotal: 20 }), () => 0.999)?.id).toBe('ouen:osaru')
  })
})

describe('長さ（maxMs）', () => {
  it('ふぃなーれは ぜんぶ maxMs をもつ。なければ 5秒', () => {
    for (const s of showsOf('finale')) expect(s.maxMs, s.id).toBeGreaterThan(0)
    expect(finaleLimit(getShow('finale:photo')!)).toBe(5000)
    expect(finaleLimit({ id: 'x', cat: 'finale', name: 'x', icon: 'x', play: () => {} })).toBe(5000)
    expect(finaleLimit(getShow('finale:parade')!)).toBeGreaterThan(8000)
    expect(finaleLimit(getShow('finale:bananatree')!)).toBeGreaterThanOrEqual(4000)
    expect(finaleLimit(getShow('finale:rocket')!)).toBeGreaterThanOrEqual(4000)
  })

  it('ことばパレード: 最大8語で 8秒以内。語が少ないほど短い', () => {
    expect(PARADE_MAX).toBe(8)
    expect(paradeMs(8)).toBeLessThanOrEqual(8000)
    expect(paradeMs(20)).toBe(paradeMs(8)) // 9語目からは数えない
    expect(paradeMs(3)).toBeLessThan(paradeMs(8))
    expect(paradeMs(8)).toBeLessThan(finaleLimit(getShow('finale:parade')!)) // 打ち切りより先に終わる
  })

  it('ハプニングは 3秒以内。でてくるは 0.8秒以内', () => {
    expect(HAP_MAX).toBeLessThanOrEqual(3000)
    for (const s of HAPPENING_SHOWS) expect(s.maxMs, s.id).toBeLessThanOrEqual(3000)
    expect(DETEKU_MS).toBeLessThanOrEqual(800)
  })
})

describe('おうえんの数と置き場所', () => {
  it('おさる: E が上がるほど増える（1〜12）', () => {
    expect(osaruCount(0)).toBe(1)
    expect(osaruCount(1)).toBe(CHEER_SLOTS)
    expect(osaruCount(0.5)).toBeGreaterThan(osaruCount(0.2))
    expect(osaruCount(2)).toBe(CHEER_SLOTS)
  })

  it('ことり: 正解のたび1羽ずつ、最大5', () => {
    expect([0, 1, 4, 5, 9].map(birdCount)).toEqual([0, 1, 4, BIRD_MAX, BIRD_MAX])
  })

  it('なかま: 最大12個。新しいものを残す。置き場所は かさならない', () => {
    const words = Array.from({ length: 15 }, (_, i) => `w${i}`)
    const items = nakamaItems(words)
    expect(items).toHaveLength(12)
    expect(items[0].word).toBe('w3')
    expect(items[11].word).toBe('w14')
    expect(new Set(items.map((x) => x.slot)).size).toBe(12)
    expect(nakamaItems(['a', 'b']).map((x) => x.slot)).toEqual([0, 1])
  })

  it('置き場所: 左右に交互・下から上へ。カードの内側（0〜100%）におさまる', () => {
    expect(cheerSlot(0)).toMatchObject({ side: 'left', row: 0 })
    expect(cheerSlot(1)).toMatchObject({ side: 'right', row: 0 })
    expect(cheerSlot(2)).toMatchObject({ side: 'left', row: 1 })
    const ys = Array.from({ length: CHEER_SLOTS }, (_, k) => cheerSlot(k).y)
    for (const y of ys) expect(y).toBeGreaterThan(5)
    for (const y of ys) expect(y).toBeLessThan(95)
    expect(new Set(Array.from({ length: CHEER_SLOTS }, (_, k) => `${cheerSlot(k).side}${cheerSlot(k).row}`)).size).toBe(CHEER_SLOTS)
  })
})

describe('ハプニングを起こす決めかた', () => {
  const base = { day: '2026-10-11', charId: 'p1', plays: 0, seen: {}, goal: 50, ids: HAP }

  it('同じ日・同じキャラ・同じ回数なら いつも同じ結果', () => {
    for (let d = 1; d <= 30; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`
      expect(planHappening({ ...base, day })).toEqual(planHappening({ ...base, day }))
    }
  })

  it('日付・キャラ・回数が変わると結果が変わりうる', () => {
    const plans = new Set<string>()
    for (let d = 1; d <= 28; d++) for (const charId of ['p1', 'p2']) for (const plays of [0, 1]) plans.add(JSON.stringify(planHappening({ ...base, day: `2026-12-${String(d).padStart(2, '0')}`, charId, plays })))
    expect(plans.size).toBeGreaterThan(10)
  })

  it('?seed が変わると変わりうる（同じ ?seed なら同じ）', () => {
    const a = Array.from({ length: 30 }, (_, i) => JSON.stringify(planHappening({ ...base, day: `2027-01-${String(i + 1).padStart(2, '0')}`, salt: '1' })))
    const b = Array.from({ length: 30 }, (_, i) => JSON.stringify(planHappening({ ...base, day: `2027-01-${String(i + 1).padStart(2, '0')}`, salt: '2' })))
    expect(a).not.toEqual(b)
    expect(a).toEqual(Array.from({ length: 30 }, (_, i) => JSON.stringify(planHappening({ ...base, day: `2027-01-${String(i + 1).padStart(2, '0')}`, salt: '1' }))))
  })

  it('1回のプレイで 0回か1回。何問目かは 2〜9（goal が小さければ goal まで）。id は登録されたもの', () => {
    for (let i = 0; i < 400; i++) {
      const p = planHappening({ ...base, day: `2028-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`, charId: `c${i}`, plays: i % 4 })
      if (!p) continue
      expect(HAP).toContain(p.id)
      expect(p.at).toBeGreaterThanOrEqual(2)
      expect(p.at).toBeLessThanOrEqual(HAP_AT_MAX)
    }
    for (let i = 0; i < 200; i++) {
      const p = planHappening({ ...base, goal: 4, charId: `c${i}` })
      if (p) expect(p.at).toBeLessThanOrEqual(4)
    }
    expect(planHappening({ ...base, goal: 1 })).toBeNull()
    expect(planHappening({ ...base, ids: [] })).toBeNull()
  })

  it('1日1回くらい: 1日に2回遊ぶと、平均 0.8〜1.3 回 見られる', () => {
    let n = 0
    const days = 600
    for (let d = 0; d < days; d++) {
      const day = dayKey(Date.UTC(2026, 0, 1) + d * 86400000)
      for (const plays of [0, 1]) if (planHappening({ ...base, day, plays })) n++
    }
    expect(n / days).toBeGreaterThan(0.8)
    expect(n / days).toBeLessThan(1.3)
    expect(hapChance(0)).toBeGreaterThan(hapChance(1))
    expect(hapChance(1)).toBeGreaterThan(hapChance(2))
    expect(hapChance(50)).toBeGreaterThan(0)
  })

  it('まだ見ていないものを優先する。ぜんぶ見たら どれでも', () => {
    const seen = Object.fromEntries(HAP.slice(0, 9).map((id) => [id, 1])) // のこり1つ: hap:nagareboshi
    const got = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const p = planHappening({ ...base, seen, charId: `c${i}` })
      if (p) got.add(p.id)
    }
    expect([...got]).toEqual(['hap:nagareboshi'])
    const all = Object.fromEntries(HAP.map((id) => [id, 1]))
    const again = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const p = planHappening({ ...base, seen: all, charId: `c${i}` })
      if (p) again.add(p.id)
    }
    expect(again.size).toBe(10)
  })

  it('?hap=<id> は かならず2問目', () => {
    expect(forcedPlan('hap:kirin')).toEqual({ id: 'hap:kirin', at: 2 })
  })
})

describe('ハプニングの記録（applyResult）', () => {
  const T = new Date(2026, 9, 11, 12).getTime()
  const res = (happenings: string[]): QuizResult => ({ correct: 1, total: 1, coins: 10, bestCombo: 1, answers: [{ id: 'a', ok: true }], cleared: false, happenings })

  it('はじめて見たら seen に時刻が入り、newShows に出る', () => {
    const { save, events } = applyResult(emptySave(), res(['hap:ufo']), T, 1)
    expect(save.shows.seen).toEqual({ 'hap:ufo': T })
    expect(events.newShows).toContain('hap:ufo')
    expect(save.shows.got['hap:ufo']).toBe(T)
  })

  it('2回目以降は 時刻を変えず、newShows にも出さない', () => {
    const a = applyResult(emptySave(), res(['hap:ufo']), T, 1)
    const b = applyResult(a.save, res(['hap:ufo']), T + 86400000, 1)
    expect(b.save.shows.seen['hap:ufo']).toBe(T)
    expect(b.save.shows.got['hap:ufo']).toBe(T)
    expect(b.events.newShows).not.toContain('hap:ufo')
  })

  it('見ていなければ何も入らない。同じプレイで同じものが2回あっても1つ。登録のない id は無視', () => {
    expect(applyResult(emptySave(), res([]), T, 1).save.shows.seen).toEqual({})
    const r = applyResult(emptySave(), res(['hap:niji', 'hap:niji', 'hap:nothing']), T, 1)
    expect(Object.keys(r.save.shows.seen)).toEqual(['hap:niji'])
    expect(r.events.newShows.filter((id) => id === 'hap:niji')).toHaveLength(1)
  })

  it('ずかんの集計に反映される（みつけた数）', () => {
    const { save } = applyResult(emptySave(), res(['hap:kujira', 'hap:hato']), T, 1)
    expect(bookCounts(withU({ seen: save.shows.seen }), save.shows.got).byCat.happening.got).toBe(2)
  })

  it('ほかの解放と同じプレイでも、newShows に両方入る。みつけたばかりのハプニングが先頭（プレゼントは3つまで）', () => {
    // ぴったり3回目のプレイ: でてくる プレゼント（plays>=3）も新しい
    const s = { ...emptySave(), plays: 2 }
    const { events } = applyResult(s, res(['hap:ufo']), T, 1)
    expect(events.newShows).toContain('deteku:present')
    expect(events.newShows[0]).toBe('hap:ufo')
    expect(events.newShows.filter((id) => id === 'hap:ufo')).toHaveLength(1)
  })
})

describe('新しい声', () => {
  it('みつけた！・ばあ！ は voice_lines.py にある（ないと端末の合成音声になる）', () => {
    const py = voiceLines
    expect(py).toContain("'みつけた！'")
    expect(py).toContain("'ばあ！'")
  })

  it('SHOWS に重複がない', () => {
    expect(new Set(ids(SHOWS)).size).toBe(SHOWS.length)
  })
})
