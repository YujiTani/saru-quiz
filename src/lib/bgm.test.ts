import { describe, expect, it } from 'vitest'
import { BGM_LAYERS, SONGS, bpmAt, layersAt, midi, parseTrack, songOf, stepSec } from './bgm'

describe('layersAt（E → 鳴らす楽器）', () => {
  it('はじめは たいこだけ', () => {
    expect(layersAt(0)).toEqual(['drum'])
    expect(layersAt(0.19)).toEqual(['drum'])
  })

  it('0.2 でベース、0.4 でマリンバ、0.6 でラッパ、0.8 でコーラス', () => {
    expect(layersAt(0.2)).toEqual(['drum', 'bass'])
    expect(layersAt(0.39)).toEqual(['drum', 'bass'])
    expect(layersAt(0.4)).toEqual(['drum', 'bass', 'marimba'])
    expect(layersAt(0.6)).toEqual(['drum', 'bass', 'marimba', 'lead'])
    expect(layersAt(0.79)).toEqual(['drum', 'bass', 'marimba', 'lead'])
    expect(layersAt(0.8)).toEqual(['drum', 'bass', 'marimba', 'lead', 'choir'])
    expect(layersAt(1)).toHaveLength(5)
  })

  it('せいかい数 ÷ クリアの数 の ちょうどの値でも加わる（小数のずれに強い）', () => {
    for (const goal of [50, 55, 60, 20, 10]) {
      for (const l of BGM_LAYERS) {
        const n = Math.round(l.at * goal)
        if (Math.abs(n / goal - l.at) < 1e-12) expect(layersAt(n / goal), `${goal}問の${n}問め`).toContain(l.id)
      }
    }
  })

  it('E が増えるほど楽器は減らない', () => {
    let last = 0
    for (let i = 0; i <= 100; i++) {
      const n = layersAt(i / 100).length
      expect(n).toBeGreaterThanOrEqual(last)
      last = n
    }
  })
})

describe('テンポ', () => {
  it('E=0 で 100、E=1 で 124、その間はだんだん上がる', () => {
    expect(bpmAt(0)).toBe(100)
    expect(bpmAt(1)).toBe(124)
    expect(bpmAt(0.5)).toBe(112)
    expect(bpmAt(2)).toBe(124) // はみ出しても 124 まで
    expect(bpmAt(-1)).toBe(100)
  })

  it('曲ごとの倍率がかかる。こもりうたは ゆっくり', () => {
    expect(bpmAt(0, SONGS.komoriuta.bpmScale)).toBeLessThan(70)
    expect(bpmAt(1, SONGS.komoriuta.bpmScale)).toBeLessThan(80)
  })

  it('1ステップ（8分音符）の長さ', () => {
    expect(stepSec(120)).toBeCloseTo(0.25)
    expect(stepSec(100)).toBeCloseTo(0.3)
  })
})

describe('楽譜の読みこみ', () => {
  it('音の名前 → MIDI番号', () => {
    expect(midi('C4')).toBe(60)
    expect(midi('A4')).toBe(69)
    expect(midi('F#3')).toBe(54)
    expect(midi('Bb2')).toBe(46)
    expect(() => midi('H4')).toThrow()
  })

  it('長さは : のあと。つづく ステップは休みとして うまる', () => {
    const t = parseTrack('C5:2 - E5 Am:3')
    expect(t).toHaveLength(2 + 1 + 1 + 3)
    expect(t[0]).toEqual({ n: [72], len: 2 })
    expect(t[1]).toBeNull()
    expect(t[2]).toBeNull()
    expect(t[3]).toEqual({ n: [76], len: 1 })
    expect(t[4]?.n).toEqual([57, 60, 64])
  })
})

describe('4つの曲', () => {
  const songs = Object.values(SONGS)

  it('おんがくの演出と同じ 4曲', () => {
    expect(Object.keys(SONGS).sort()).toEqual(['komoriuta', 'march', 'matsuri', 'omocha'])
    expect(songOf('ongaku:matsuri').id).toBe('matsuri')
    expect(songOf('ongaku:なぞ').id).toBe('march')
  })

  it('どの楽器も、曲のながさ（ステップ数）ぴったり', () => {
    for (const s of songs) {
      expect(s.bass, s.id).toHaveLength(s.steps)
      expect(s.marimba, s.id).toHaveLength(s.steps)
      expect(s.lead, s.id).toHaveLength(s.steps)
      expect(s.choir, s.id).toHaveLength(s.steps)
      expect(s.steps % s.barSteps, s.id).toBe(0)
      expect(s.drums, s.id).toHaveLength(s.steps / s.barSteps)
      for (const bar of s.drums) {
        expect(bar, s.id).toHaveLength(s.barSteps)
        expect(bar, s.id).toMatch(/^[Khdk.]+$/)
      }
    }
  })

  it('音の高さが 耳にやさしい はんい', () => {
    for (const s of songs)
      for (const [name, lo, hi] of [['bass', 36, 56], ['marimba', 54, 84], ['lead', 60, 86], ['choir', 54, 84]] as const)
        for (const st of s[name])
          for (const n of st?.n ?? []) expect(n >= lo && n <= hi, `${s.id} ${name} ${n}`).toBe(true)
  })

  it('3拍子は こもりうただけ。ゆっくり', () => {
    expect(SONGS.komoriuta.barSteps).toBe(6)
    for (const s of [SONGS.march, SONGS.matsuri, SONGS.omocha]) expect(s.barSteps).toBe(8)
    expect(SONGS.komoriuta.bpmScale).toBeLessThan(SONGS.march.bpmScale)
  })

  it('おまつりは たいこ（どん・かっ）が多く、ペンタトニック（ファ・シがない）', () => {
    const taiko = (s: string) => [...s].filter((c) => c === 'd' || c === 'k').length
    expect(SONGS.matsuri.drums.join('').split('').filter((c) => c === 'd' || c === 'k').length).toBeGreaterThan(taiko(SONGS.march.drums.join('')) + 8)
    const pcs = new Set(SONGS.matsuri.lead.flatMap((s) => (s ? s.n.map((n) => n % 12) : [])))
    expect(pcs.has(5)).toBe(false)
    expect(pcs.has(11)).toBe(false)
  })

  it('おもちゃは スタッカート', () => {
    expect(SONGS.omocha.staccato).toBe(true)
    expect(SONGS.march.staccato).toBe(false)
  })
})
