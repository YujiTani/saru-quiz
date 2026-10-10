import { describe, expect, it } from 'vitest'
import questions from '../data/questions.json'
import { STICKER_IDS, STICKER_KINDS, stickerComplete, stickerImg, stickerInSet, stickerKind } from './stickers'

describe('シール', () => {
  it('どうぶつ7種類。questions.json にある id で、絵がある', () => {
    expect(STICKER_KINDS).toBe(7)
    expect(new Set(STICKER_IDS).size).toBe(7)
    for (const id of STICKER_IDS) {
      const q = (questions as { questions: { id: string; img?: string; c: string }[] }).questions.find((x) => x.id === id)
      expect(q, id).toBeTruthy()
      expect(q!.img, id).toBe(stickerImg(STICKER_IDS.indexOf(id)).replace(/^/, ''))
      expect(q!.c).toBe('どうぶつ')
    }
  })

  it('n 枚目の種類は 順番に 0〜6 をぐるぐる', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15].map(stickerKind)).toEqual([0, 1, 2, 3, 4, 5, 6, 0, 1, 6, 0])
  })

  it('7の倍数でそろった', () => {
    expect([0, 1, 6, 7, 8, 13, 14, 21].map(stickerComplete)).toEqual([false, false, false, true, false, false, true, true])
  })

  it('今のセットの何枚目か（7枚そろった直後は 7）', () => {
    expect([0, 1, 3, 7, 8, 14, 15].map(stickerInSet)).toEqual([0, 1, 3, 7, 1, 7, 1])
  })
})
