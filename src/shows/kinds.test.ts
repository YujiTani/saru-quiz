import { describe, expect, it } from 'vitest'
import { PHRASES, instrumentOf, phraseLength } from '../lib/instruments'
import { allQuestions } from '../lib/quiz'
import { seasonOf, weatherOf, wearsOnHead } from './kinds'

const q = (id: string) => ({ id })
const byCat = (c: string) => allQuestions.filter((x) => x.c === c)

describe('weatherOf（しぜん・てんき の単語から天気）', () => {
  it('あめ・ゆき・にじ・たいよう・かみなり・かぜ を見分ける', () => {
    expect(weatherOf(q('rain'))).toBe('rain')
    expect(weatherOf(q('puddle'))).toBe('rain')
    expect(weatherOf(q('snow'))).toBe('snow')
    expect(weatherOf(q('snowman'))).toBe('snow')
    expect(weatherOf(q('rainbow'))).toBe('rainbow')
    expect(weatherOf(q('sun'))).toBe('sun')
    expect(weatherOf(q('lightning'))).toBe('thunder')
    expect(weatherOf(q('wind'))).toBe('wind')
    expect(weatherOf(q('tornado'))).toBe('wind')
  })

  it('どれにも当たらない・単語がないときは きらきら', () => {
    expect(weatherOf(q('cloud'))).toBe('sparkle')
    expect(weatherOf(q('mountain'))).toBe('sparkle')
    expect(weatherOf(undefined)).toBe('sparkle')
  })

  it('しぜん・てんき の単語に、6つの天気がぜんぶ出てくる（id の書きまちがい防止）', () => {
    const got = new Set(byCat('しぜん・てんき').map(weatherOf))
    for (const w of ['rain', 'snow', 'rainbow', 'sun', 'thunder', 'wind', 'sparkle']) expect(got.has(w as never), w).toBe(true)
  })

  it('rain は雨っぽいことばにだけ（あいまいな部分一致をしない）', () => {
    expect(weatherOf(q('rain-boots'))).toBe('sparkle')
    expect(weatherOf(q('rainbow'))).not.toBe('rain')
  })
})

describe('instrumentOf（がっき・おと の単語から楽器）', () => {
  it('たいこ・ぴあの・らっぱ・すず・ほかは木琴', () => {
    expect(instrumentOf(q('drum'))).toBe('drum')
    expect(instrumentOf(q('piano'))).toBe('piano')
    expect(instrumentOf(q('trumpet'))).toBe('trumpet')
    expect(instrumentOf(q('jingle-bell'))).toBe('bell')
    expect(instrumentOf(q('guitar'))).toBe('marimba')
    expect(instrumentOf(q('xylophone'))).toBe('marimba')
    expect(instrumentOf(undefined)).toBe('marimba')
  })

  it('がっき・おと の単語に、5つの楽器がぜんぶ出てくる', () => {
    const got = new Set(byCat('がっき・おと').map(instrumentOf))
    expect(got).toEqual(new Set(['drum', 'piano', 'trumpet', 'bell', 'marimba']))
  })

  it('フレーズは時間じゅんで、1.5秒より短い。ぴあのは ドレミ（3音）', () => {
    for (const [k, p] of Object.entries(PHRASES)) {
      expect(p.length, k).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < p.length; i++) expect(p[i].t, k).toBeGreaterThan(p[i - 1].t)
      expect(phraseLength(k as never), k).toBeLessThan(1.6)
    }
    expect(PHRASES.piano.map((x) => x.n)).toEqual([72, 74, 76])
  })
})

describe('seasonOf（きせつ・ぎょうじ）', () => {
  it('3〜5月は花びら、6〜8月は泡、9〜11月は葉っぱ、12〜2月は雪', () => {
    const kinds = Array.from({ length: 12 }, (_, i) => seasonOf(i + 1).kind)
    expect(kinds).toEqual(['snow', 'snow', 'petal', 'petal', 'petal', 'bubble', 'bubble', 'bubble', 'leaf', 'leaf', 'leaf', 'snow'])
  })
})

describe('wearsOnHead（ふく・みにつけるもの）', () => {
  it('頭のものは頭に、それ以外は からだに', () => {
    expect(wearsOnHead(q('hat'))).toBe(true)
    expect(wearsOnHead(q('crown'))).toBe(true)
    expect(wearsOnHead(q('shirt'))).toBe(false)
    expect(wearsOnHead(q('shoes'))).toBe(false)
    expect(wearsOnHead(undefined)).toBe(false)
  })
})
