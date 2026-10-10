import { describe, expect, it } from 'vitest'
import { LANDMARKS, MICHI_SHOWS, crossed, roadX, skyStage, themeOf } from './michi'
import { ONGAKU_SHOWS } from './ongaku'
import { isUnlocked, ownedIn, pickShow } from './registry'
import { seeded } from '../lib/rng'
import type { UnlockCtx } from './types'

const u0: UnlockCtx = { masteredTotal: 0, masteredByCat: {}, starsTotal: 0, playDays: 0, plays: 0, clears: 0, polishedTotal: 0, seen: {} }
const withU = (p: Partial<UnlockCtx>): UnlockCtx => ({ ...u0, ...p })
const get = (l: { id: string }[], id: string) => l.find((s) => s.id === id)! as (typeof MICHI_SHOWS)[number]

describe('skyStage（E → 空の段階）', () => {
  it('朝 → 昼 → 夕焼け → 夜', () => {
    expect(skyStage(0)).toBe('morning')
    expect(skyStage(0.24)).toBe('morning')
    expect(skyStage(0.25)).toBe('day')
    expect(skyStage(0.54)).toBe('day')
    expect(skyStage(0.55)).toBe('evening')
    expect(skyStage(0.84)).toBe('evening')
    expect(skyStage(0.85)).toBe('night')
    expect(skyStage(1)).toBe('night')
  })

  it('E が増えると 段階はもどらない', () => {
    const order = ['morning', 'day', 'evening', 'night']
    let last = 0
    for (let i = 0; i <= 100; i++) {
      const k = order.indexOf(skyStage(i / 100))
      expect(k).toBeGreaterThanOrEqual(last)
      last = k
    }
  })

  it('最後の数問は夜（かんたん50問なら 43問め〜）', () => {
    expect(skyStage(42 / 50)).toBe('evening')
    expect(skyStage(43 / 50)).toBe('night')
  })
})

describe('みちのりの目じるし', () => {
  it('橋は 1/3、どうくつは 2/3', () => {
    expect(LANDMARKS.bridge).toBeCloseTo(1 / 3)
    expect(LANDMARKS.cave).toBeCloseTo(2 / 3)
  })

  it('通りすぎた（ぴったり着いたときも）1回だけ数える', () => {
    expect(crossed(0, 0.2, LANDMARKS.bridge)).toBe(false)
    expect(crossed(0.3, 0.34, LANDMARKS.bridge)).toBe(true)
    expect(crossed(0.34, 0.4, LANDMARKS.bridge)).toBe(false)
    expect(crossed(2 / 6, 3 / 6, LANDMARKS.bridge)).toBe(false)
    expect(crossed(1 / 6, 2 / 6, LANDMARKS.bridge)).toBe(true) // 6問の2問めでちょうど 1/3
    expect(crossed(3 / 6, 4 / 6, LANDMARKS.cave)).toBe(true) // 6問の4問めでちょうど 2/3
    expect(crossed(0, 1, LANDMARKS.cave)).toBe(true)
  })

  it('道の位置は 0〜1 の中にいる（はみださない）', () => {
    expect(roadX(0)).toBeLessThan(roadX(1))
    expect(roadX(-1)).toBe(roadX(0))
    expect(roadX(2)).toBe(roadX(1))
    expect(roadX(1)).toBeLessThan(90) // ゴールの木の手前
  })
})

describe('みちのり・おんがくの演出', () => {
  it('みちのりは4種類。じゃんぐるだけ はじめから', () => {
    expect(MICHI_SHOWS.map((s) => s.id)).toEqual(['michi:jungle', 'michi:umi', 'michi:okashi', 'michi:uchu'])
    expect(MICHI_SHOWS.every((s) => s.cat === 'michi')).toBe(true)
    expect(get(MICHI_SHOWS, 'michi:jungle').base).toBe(true)
    expect(ownedIn('michi', u0).map((s) => s.id)).toEqual(['michi:jungle'])
  })

  it('おんがくは4曲。じゃんぐるまーちだけ はじめから', () => {
    expect(ONGAKU_SHOWS.map((s) => s.id)).toEqual(['ongaku:march', 'ongaku:matsuri', 'ongaku:omocha', 'ongaku:komoriuta'])
    expect(ownedIn('ongaku', u0).map((s) => s.id)).toEqual(['ongaku:march'])
  })

  it('うみのそこ・おまつり: 3日あそぶ（playDays>=3）', () => {
    for (const id of ['michi:umi', 'ongaku:matsuri']) {
      const s = ([...MICHI_SHOWS, ...ONGAKU_SHOWS] as { id: string }[]).find((x) => x.id === id)! as (typeof MICHI_SHOWS)[number]
      expect(isUnlocked(s, withU({ playDays: 2 })), id).toBe(false)
      expect(isUnlocked(s, withU({ playDays: 3 })), id).toBe(true)
    }
  })

  it('おかしのくに・おもちゃのぎょうれつ: クリア3回（clears>=3）', () => {
    for (const s of [get(MICHI_SHOWS, 'michi:okashi'), get(ONGAKU_SHOWS, 'ongaku:omocha')]) {
      expect(isUnlocked(s, withU({ clears: 2 })), s.id).toBe(false)
      expect(isUnlocked(s, withU({ clears: 3 })), s.id).toBe(true)
    }
  })

  it('うちゅうは ☆30こ、こもりうたは ☆20こ（starsTotal）', () => {
    const uchu = get(MICHI_SHOWS, 'michi:uchu')
    expect(isUnlocked(uchu, withU({ starsTotal: 29 }))).toBe(false)
    expect(isUnlocked(uchu, withU({ starsTotal: 30 }))).toBe(true)
    const nenne = get(ONGAKU_SHOWS, 'ongaku:komoriuta')
    expect(isUnlocked(nenne, withU({ starsTotal: 19 }))).toBe(false)
    expect(isUnlocked(nenne, withU({ starsTotal: 20 }))).toBe(true)
  })

  it('ぜんぶ手に入れたら、固定した曲・道が選ばれる。おまかせは持っているものから', () => {
    const all = withU({ playDays: 9, clears: 9, starsTotal: 99 })
    expect(pickShow('michi', { michi: 'michi:uchu' }, all, seeded('a'))?.id).toBe('michi:uchu')
    expect(pickShow('ongaku', { ongaku: 'ongaku:komoriuta' }, all, seeded('a'))?.id).toBe('ongaku:komoriuta')
    for (let i = 0; i < 20; i++) expect(pickShow('michi', {}, u0, seeded(String(i)))?.id).toBe('michi:jungle')
    // まだ持っていない固定は無視して、持っているものから
    expect(pickShow('ongaku', { ongaku: 'ongaku:komoriuta' }, u0, seeded('a'))?.id).toBe('ongaku:march')
  })

  it('themeOf は id から見た目を決める。知らない id は じゃんぐる', () => {
    expect(themeOf('michi:umi')).toBe('umi')
    expect(themeOf('michi:okashi')).toBe('okashi')
    expect(themeOf('michi:uchu')).toBe('uchu')
    expect(themeOf('michi:jungle')).toBe('jungle')
    expect(themeOf('michi:xyz')).toBe('jungle')
    expect(themeOf(undefined)).toBe('jungle')
  })
})
