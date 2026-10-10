import { describe, expect, it } from 'vitest'
import { BANANA_STAGES } from './banana'
import { allQuestions } from './quiz'
import { SHOWS } from '../shows/registry'
import { applyResult, firstAnswers, growthLines } from './progress'
import { emptySave, normalizeSave } from './storage'
import type { LastResult, Save } from './storage'
import type { QuizResult } from '../screens/Quiz'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const T0 = at(2026, 1, 1)

const res = (answers: [string, boolean][], extra: Partial<QuizResult> = {}): QuizResult => ({
  correct: answers.filter(([, ok]) => ok).length,
  total: answers.length,
  coins: 10,
  bestCombo: 3,
  answers: answers.map(([id, ok]) => ({ id, ok })),
  cleared: false,
  ...extra,
})

describe('progress 最初の答え', () => {
  it('同じ id が2回出たら最初の ok だけ見る', () => {
    const m = firstAnswers(res([['a', false], ['b', true], ['a', true]]).answers)
    expect(m.get('a')).toBe(false)
    expect(m.get('b')).toBe(true)
  })

  it('まちがえてから正解した単語は、段が上がらない', () => {
    const { save, events } = applyResult(emptySave(), res([['a', false], ['a', true]]), T0, 1)
    expect(save.stats.a.box).toBe(0)
    expect(save.stats.a).toMatchObject({ ok: 1, ng: 1, last: T0 })
    expect(events.starUps).toEqual([])
  })

  it('最初で正解すると☆1。events に出る', () => {
    const { save, events } = applyResult(emptySave(), res([['a', true], ['b', false], ['b', true]]), T0, 1)
    expect(save.stats.a.box).toBe(1)
    expect(events.newMastered).toEqual(['a'])
    expect(events.starUps).toEqual([['a', 1]])
    expect(events.polished).toEqual([])
  })

  it('古い ok/ng から移しかえてから数える', () => {
    const base: Save = { ...emptySave(), stats: { a: { ok: 3, ng: 0, last: at(2025, 12, 31) } } }
    const { save, events } = applyResult(base, res([['a', true]]), T0, 1)
    expect(save.stats.a.ok).toBe(4)
    expect(save.stats.a.box).toBe(2) // 移しかえで段1、1日たっているので段2
    expect(events.starUps).toEqual([['a', 2]])
    expect(events.newMastered).toEqual([])
  })

  it('くもりをみがくと polished', () => {
    const base: Save = { ...emptySave(), stats: { a: { ok: 3, ng: 0, last: at(2025, 12, 1) } } }
    // 段1 の due は 12/2、猶予1日。ずっとあとなので、くもり
    const { events } = applyResult(base, res([['a', true]]), at(2026, 3, 1), 1)
    expect(events.polished).toEqual(['a'])
  })
})

describe('progress 記録', () => {
  it('coins / bestCombo / plays / cleared / lastResult', () => {
    const base: Save = { ...emptySave(), coins: 5, bestCombo: 9, plays: 2, cleared: [1] }
    const { save } = applyResult(base, res([['a', true]], { cleared: true, clearMs: 12345, bestCombo: 4 }), T0, 2)
    expect(save).toMatchObject({ coins: 15, bestCombo: 9, plays: 3, cleared: [1, 2] })
    expect(save.lastResult).toEqual({ correct: 1, bestCombo: 4, clearMs: 12345, level: 2, at: T0 })
    expect(applyResult(save, res([['a', true]], { cleared: true }), T0, 2).save.cleared).toEqual([1, 2])
  })

  it('元の Save を書きかえない', () => {
    const base = emptySave()
    applyResult(base, res([['a', true]]), T0, 1)
    expect(base).toEqual(emptySave())
  })

  it('diary: その日の単語（重複なし・最大30）と回数。firstPlayToday は1回目だけ', () => {
    const first = applyResult(emptySave(), res([['a', true], ['b', false], ['a', true]]), T0, 1)
    expect(first.events.firstPlayToday).toBe(true)
    expect(first.save.diary['2026-01-01']).toEqual({ words: ['a'], plays: 1, mastered: ['a'], sticker: 0 })

    const second = applyResult(first.save, res([['a', true], ['c', true]]), T0 + 3600_000, 1)
    expect(second.events.firstPlayToday).toBe(false)
    expect(second.save.diary['2026-01-01']).toEqual({ words: ['a', 'c'], plays: 2, mastered: ['a', 'c'], sticker: 0 })

    const nextDay = applyResult(second.save, res([['d', true]]), at(2026, 1, 2), 1)
    expect(nextDay.events.firstPlayToday).toBe(true)
    expect(Object.keys(nextDay.save.diary)).toEqual(['2026-01-01', '2026-01-02'])

    const many = res(Array.from({ length: 40 }, (_, i) => [`w${i}`, true] as [string, boolean]))
    expect(applyResult(emptySave(), many, T0, 1).save.diary['2026-01-01'].words).toHaveLength(30)
  })

  it('review: 最初の答えでまちがえた単語だけ入る', () => {
    const { save } = applyResult(emptySave(), res([['a', false], ['a', true], ['b', true], ['c', false]]), T0, 1)
    expect(save.review).toEqual(['a', 'c'])
  })

  it('review: 通常のプレイでは正解しても外れない。ふくしゅうモードで最初に正解すると外れる', () => {
    const base: Save = { ...emptySave(), review: ['a', 'b'] }
    expect(applyResult(base, res([['a', true]]), T0, 1).save.review).toEqual(['a', 'b'])
    expect(applyResult(base, res([['a', true], ['b', false], ['b', true]]), T0, 1, true).save.review).toEqual(['b'])
  })

  it('review: 最大30（古いものから落とす）', () => {
    const base: Save = { ...emptySave(), review: Array.from({ length: 30 }, (_, i) => `r${i}`) }
    const { save } = applyResult(base, res([['x', false]]), T0, 1)
    expect(save.review).toHaveLength(30)
    expect(save.review[0]).toBe('r1')
    expect(save.review[29]).toBe('x')
  })
})

describe('growthLines まえより のびたよ', () => {
  const prev: LastResult = { correct: 10, bestCombo: 5, clearMs: 60_000, level: 1, at: T0 }

  it('前回がなければ何も出さない', () => {
    expect(growthLines(undefined, { correct: 99, bestCombo: 99 }, 1)).toEqual([])
  })

  it('のびた項目だけ出す', () => {
    expect(growthLines(prev, { correct: 12, bestCombo: 5 }, 1).map((l) => l.speech)).toEqual(['せいかいが、ふえたよ！'])
    expect(growthLines(prev, { correct: 10, bestCombo: 7 }, 1).map((l) => l.speech)).toEqual(['れんぞくが、のびたよ！'])
    expect(growthLines(prev, { correct: 10, bestCombo: 5, clearMs: 50_000 }, 1).map((l) => l.speech)).toEqual(['くりあたいむが、はやくなったよ！'])
  })

  it('のびていなければ（同じ・へった・おそくなった）何も出さない', () => {
    expect(growthLines(prev, { correct: 10, bestCombo: 5, clearMs: 60_000 }, 1)).toEqual([])
    expect(growthLines(prev, { correct: 3, bestCombo: 2, clearMs: 90_000 }, 1)).toEqual([])
  })

  it('前回がクリアしていない（clearMs なし）ときは タイムを比べない', () => {
    expect(growthLines({ ...prev, clearMs: undefined }, { correct: 10, bestCombo: 5, clearMs: 30_000 }, 1)).toEqual([])
  })

  it('3つとも のびたら 3行（せいかい → れんぞく → タイムの順）。text に前回と今回が入る', () => {
    const lines = growthLines(prev, { correct: 20, bestCombo: 9, clearMs: 45_000 }, 1)
    expect(lines).toHaveLength(3)
    expect(lines.map((l) => l.speech)).toEqual(['せいかいが、ふえたよ！', 'れんぞくが、のびたよ！', 'くりあたいむが、はやくなったよ！'])
    expect(lines[0].text).toBe('せいかい 10 → 20')
    expect(lines[2].text).toBe('くりあたいむ 1ふん00びょう → 0ふん45びょう')
  })

  it('ちがうコースの前回とは比べない', () => {
    expect(growthLines({ ...prev, level: 2 }, { correct: 99, bestCombo: 99 }, 1)).toEqual([])
  })
})

describe('lastByLevel コースごとの前回', () => {
  it('コースごとに持つ。ほかのコースの結果は消えない', () => {
    const a = applyResult(emptySave(), res([['a', true]], { bestCombo: 2 }), T0, 1)
    const b = applyResult(a.save, res([['a', true], ['b', true]], { bestCombo: 3 }), T0 + 1000, 2)
    expect(Object.keys(b.save.lastByLevel)).toEqual(['1', '2'])
    expect(b.save.lastByLevel[1]).toMatchObject({ correct: 1, bestCombo: 2, level: 1 })
    expect(b.save.lastByLevel[2]).toMatchObject({ correct: 2, bestCombo: 3, level: 2 })
    expect(b.save.lastResult).toEqual(b.save.lastByLevel[2])
  })

  it('2回目に のびていれば events.growth に出る。同じコースの前回と比べる', () => {
    const a = applyResult(emptySave(), res([['a', true]]), T0, 1)
    expect(a.events.growth).toEqual([])
    const other = applyResult(a.save, res([['a', true]]), T0, 2) // 別のコースを挟んでも
    const b = applyResult(other.save, res([['a', true], ['b', true], ['c', true]], { bestCombo: 3 }), T0, 1)
    expect(b.events.growth.map((l) => l.speech)).toEqual(['せいかいが、ふえたよ！'])
  })

  it('古いデータ（lastResult だけ）は lastByLevel に移す', () => {
    const old = { ...emptySave(), lastResult: { correct: 4, bestCombo: 2, level: 2, at: T0 } } as Save
    delete (old as Partial<Save>).lastByLevel
    expect(normalizeSave(old).lastByLevel).toEqual({ 2: old.lastResult })
    // そのまま applyResult に渡しても、前回として比べられる
    const r = applyResult(old, res([['a', true], ['b', true], ['c', true], ['d', true], ['e', true]], { bestCombo: 2 }), T0, 2)
    expect(r.events.growth.map((l) => l.speech)).toEqual(['せいかいが、ふえたよ！'])
    expect(r.save.lastByLevel[2].correct).toBe(5)
  })

  it('すでに lastByLevel があれば lastResult で上書きしない', () => {
    const cur = { correct: 9, bestCombo: 1, level: 1, at: T0 }
    const s = normalizeSave({ ...emptySave(), lastResult: { ...cur, correct: 1 }, lastByLevel: { 1: cur } })
    expect(s.lastByLevel[1]).toEqual(cur)
  })

  it('ふくしゅうモードは、クリア（解放）にも「まえより」の記録にも入れない', () => {
    const base: Save = { ...emptySave(), review: ['a'] }
    const { save, events } = applyResult(base, res([['a', true]], { cleared: true, clearMs: 1000 }), T0, 2, true)
    expect(save.cleared).toEqual([])
    expect(save.lastResult).toBeUndefined()
    expect(save.lastByLevel).toEqual({})
    expect(events.growth).toEqual([])
    expect(save.review).toEqual([]) // 最初に正解したので外れる
  })
})

describe('diary の mastered（☆1になった日）', () => {
  it('その日 ☆1になった単語だけ入る。同じ日の2回目で足される（重複なし）', () => {
    const a = applyResult(emptySave(), res([['a', true], ['b', false]]), T0, 1)
    expect(a.save.diary['2026-01-01'].mastered).toEqual(['a'])
    const b = applyResult(a.save, res([['a', true], ['c', true]]), T0 + 3600_000, 1)
    expect(b.events.newMastered).toEqual(['c']) // a はもう☆1
    expect(b.save.diary['2026-01-01'].mastered).toEqual(['a', 'c'])
  })

  it('前の日に☆1になった単語は、次の日の mastered には入らない（words には入る）', () => {
    const a = applyResult(emptySave(), res([['a', true]]), at(2026, 1, 1), 1)
    const b = applyResult(a.save, res([['a', true], ['b', true]]), at(2026, 1, 2), 1)
    expect(b.save.diary['2026-01-02'].words).toEqual(['a', 'b'])
    expect(b.save.diary['2026-01-02'].mastered).toEqual(['b'])
    expect(b.save.diary['2026-01-01'].mastered).toEqual(['a'])
  })

  it('古いデータ（mastered がない日）でも足せる', () => {
    const old: Save = { ...emptySave(), diary: { '2026-01-01': { words: ['x'], plays: 1 } } }
    const r = applyResult(old, res([['a', true]]), T0, 1)
    expect(r.save.diary['2026-01-01']).toEqual({ words: ['x', 'a'], plays: 2, mastered: ['a'] })
  })

  it('ふくしゅうでも、その日の mastered に入る', () => {
    const base: Save = { ...emptySave(), review: ['a'] }
    expect(applyResult(base, res([['a', true]]), T0, 1, true).save.diary['2026-01-01'].mastered).toEqual(['a'])
  })
})

describe('シール（applyResult）', () => {
  it('その日はじめて遊び終わったら1枚。diary に種類が残る', () => {
    const { save, events } = applyResult(emptySave(), res([['a', true]]), T0, 1)
    expect(save.stickers).toBe(1)
    expect(save.diary['2026-01-01'].sticker).toBe(0)
    expect(events.sticker).toEqual({ kind: 0, count: 1, complete: false })
  })

  it('同じ日の2回目はもらえない（枚数も種類も変わらない）', () => {
    const a = applyResult(emptySave(), res([['a', true]]), T0, 1)
    const b = applyResult(a.save, res([['b', true]]), T0 + 60_000, 1)
    expect(b.events.sticker).toBeNull()
    expect(b.save.stickers).toBe(1)
    expect(b.save.diary['2026-01-01'].sticker).toBe(0)
  })

  it('休んでも続きから（日がとんでも 次の種類）。やり直さない', () => {
    let save = emptySave()
    const days = [1, 2, 10, 11, 25] // とびとびの日
    const kinds: number[] = []
    for (const d of days) {
      const r = applyResult(save, res([['a', true]]), at(2026, 1, d), 1)
      save = r.save
      kinds.push(r.events.sticker!.kind)
    }
    expect(kinds).toEqual([0, 1, 2, 3, 4])
    expect(save.stickers).toBe(5)
  })

  it('7枚そろったら complete。8枚目は最初の種類にもどる', () => {
    let save = emptySave()
    const out: boolean[] = []
    let last = -1
    for (let d = 1; d <= 8; d++) {
      const r = applyResult(save, res([['a', true]]), at(2026, 1, d), 1)
      save = r.save
      out.push(r.events.sticker!.complete)
      last = r.events.sticker!.kind
    }
    expect(out).toEqual([false, false, false, false, false, false, true, false])
    expect(last).toBe(0)
    expect(save.stickers).toBe(8)
  })

  it('ふくしゅうでも、その日はじめてならもらえる', () => {
    const base: Save = { ...emptySave(), review: ['a'] }
    expect(applyResult(base, res([['a', true]]), T0, 1, true).events.sticker?.count).toBe(1)
  })

  it('古い日（シールなしの diary）しかない日に遊んでも、2回目扱いでシールは増えない', () => {
    const old: Save = { ...emptySave(), diary: { '2026-01-01': { words: [], plays: 1 } } }
    const r = applyResult(old, res([['a', true]]), T0, 1)
    expect(r.events.sticker).toBeNull()
    expect(r.save.diary['2026-01-01'].sticker).toBeUndefined()
  })
})

describe('バナナのやま（applyResult）', () => {
  it('段階が上がったプレイで events.bananaUp に新しい段階が入る', () => {
    const base: Save = { ...emptySave(), coins: BANANA_STAGES[1].need - 5 }
    const r = applyResult(base, res([['a', true]], { coins: 10 }), T0, 1)
    expect(r.events.bananaUp).toBe(1)
    expect(r.save.coins).toBe(BANANA_STAGES[1].need + 5)
  })

  it('同じ段階のままなら null', () => {
    const r = applyResult({ ...emptySave(), coins: 100 }, res([['a', true]], { coins: 10 }), T0, 1)
    expect(r.events.bananaUp).toBeNull()
  })

  it('一度に何段か上がったら いちばん上の段階', () => {
    const r = applyResult(emptySave(), res([['a', true]], { coins: BANANA_STAGES[3].need + 1 }), T0, 1)
    expect(r.events.bananaUp).toBe(3)
  })
})

describe('えんしゅつ図鑑の記録（applyResult）', () => {
  const dobutsu = allQuestions.filter((q) => q.c === 'どうぶつ').slice(0, 3).map((q) => q.id)
  const box1 = (n = 1) => ({ ok: n, ng: 0, last: T0, box: 1, boxAt: T0, due: T0 + 86400000, firstOkAt: T0 })

  it('はじめてのプレイ: はじめから持っている演出（base）をまとめて got に入れる。newShows には出さない', () => {
    const r = applyResult(emptySave(), res([['zzz', true]]), T0, 1)
    const base = SHOWS.filter((s) => s.base).map((s) => s.id)
    expect(base.length).toBeGreaterThan(5)
    for (const id of base) expect(r.save.shows.got[id], id).toBe(T0)
    expect(r.events.newShows).toEqual([])
    expect(Object.keys(r.save.shows.got).sort()).toEqual([...base].sort())
  })

  it('そのカテゴリを3つおぼえたプレイで、うごくえが newShows に出て got に入る（2つ目までは出ない）', () => {
    const save: Save = { ...emptySave(), stats: { [dobutsu[0]]: box1(), [dobutsu[1]]: box1() } }
    const first = applyResult(save, res([[dobutsu[2], true]]), T0, 1)
    expect(first.events.newShows).toEqual(['ugoku:doubutsu'])
    expect(first.save.shows.got['ugoku:doubutsu']).toBe(T0)
    // 2つしかおぼえていなければ出ない
    const none = applyResult({ ...emptySave(), stats: { [dobutsu[0]]: box1() } }, res([[dobutsu[1], true]]), T0, 1)
    expect(none.events.newShows).toEqual([])
    expect(none.save.shows.got['ugoku:doubutsu']).toBeUndefined()
  })

  it('あとのプレイでは同じものが また出ない', () => {
    const save: Save = { ...emptySave(), stats: { [dobutsu[0]]: box1(), [dobutsu[1]]: box1() } }
    const a = applyResult(save, res([[dobutsu[2], true]]), T0, 1)
    const b = applyResult(a.save, res([[dobutsu[2], true]]), T0 + 3600000, 1)
    expect(b.events.newShows).toEqual([])
    expect(b.save.shows.got['ugoku:doubutsu']).toBe(T0)
  })

  it('遊んだ日が2日になったプレイで ずっこけ ぐるぐる が出る。同時に2つ手に入れたら両方', () => {
    const save: Save = { ...emptySave(), diary: { '2025-12-31': { words: [], plays: 1 } }, stats: { [dobutsu[0]]: box1(), [dobutsu[1]]: box1() } }
    const r = applyResult(save, res([[dobutsu[2], true]]), T0, 1)
    expect(r.events.newShows.sort()).toEqual(['ugoku:doubutsu', 'zukkoke:guruguru'])
  })

  it('バナナのやまが上がったプレイで、そのやまの演出も newShows に出る', () => {
    const base: Save = { ...emptySave(), coins: BANANA_STAGES[1].need - 5 }
    const r = applyResult(base, res([['a', true]], { coins: 10 }), T0, 1)
    expect(r.events.newShows).toEqual([`banana:${BANANA_STAGES[1].id}`])
  })

  it('記録をつける前から手に入れていた演出は、だまって got に入る（newShows には出さない）', () => {
    const old: Save = { ...emptySave(), stats: { [dobutsu[0]]: box1(), [dobutsu[1]]: box1(), [dobutsu[2]]: box1() } } // すでに3つおぼえていた
    const r = applyResult(old, res([['zzz', true]]), T0, 1)
    expect(r.save.shows.got['ugoku:doubutsu']).toBe(T0)
    expect(r.events.newShows).toEqual([])
  })
})
