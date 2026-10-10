import { describe, expect, it } from 'vitest'
import { MONKEY_SLOT, PHOTO_MAX, photoWords, riserLayout } from './riser'

describe('ひな壇の並べ方', () => {
  it('0〜8個。個数ぶんの置き場所を返す（9個以上は8個まで）', () => {
    for (let n = 0; n <= 8; n++) expect(riserLayout(n)).toHaveLength(n)
    expect(riserLayout(20)).toHaveLength(PHOTO_MAX)
    expect(riserLayout(-1)).toHaveLength(0)
  })

  it('枠の中におさまり、おさるの顔とは重ならない', () => {
    for (let n = 1; n <= 8; n++) {
      for (const s of riserLayout(n)) {
        expect(s.x - s.size / 2).toBeGreaterThanOrEqual(0)
        expect(s.x + s.size / 2).toBeLessThanOrEqual(1)
        expect(s.y - s.size / 2).toBeGreaterThanOrEqual(0)
        expect(s.y + s.size / 2).toBeLessThanOrEqual(1)
        // 横がおさると重なるなら、おさるの頭より上（少しだけ後ろにかくれるのはよい）
        const xOverlap = Math.abs(s.x - MONKEY_SLOT.x) < (s.size + MONKEY_SLOT.size) / 2
        const monkeyTop = MONKEY_SLOT.y - (MONKEY_SLOT.size * (18 / 16)) / 2 // ドット絵は 16×18
        if (xOverlap) expect(s.y + s.size / 2, `${n}個 ${JSON.stringify(s)}`).toBeLessThanOrEqual(monkeyTop + 0.06)
      }
    }
  })

  it('奥（上）から手前（下）の順に並べて返す', () => {
    for (let n = 2; n <= 8; n++) {
      const ys = riserLayout(n).map((s) => s.y)
      expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    }
  })

  it('同じ場所に2つ置かない', () => {
    for (let n = 1; n <= 8; n++) {
      const keys = riserLayout(n).map((s) => `${s.x},${s.y}`)
      expect(new Set(keys).size).toBe(n)
    }
  })

  it('photoWords: 正解した単語（重複なし）の新しいほう最大8個', () => {
    const answers = [
      { id: 'a', ok: true }, { id: 'b', ok: false }, { id: 'b', ok: true }, { id: 'a', ok: true },
      ...['c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id) => ({ id, ok: true })),
    ]
    expect(photoWords(answers)).toEqual(['c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
    expect(photoWords(answers.slice(0, 4))).toEqual(['a', 'b'])
    expect(photoWords([{ id: 'x', ok: false }])).toEqual([])
  })
})
