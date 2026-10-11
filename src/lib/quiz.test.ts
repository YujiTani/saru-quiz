import { describe, expect, it } from 'vitest'
import { seeded } from './rng'
import { allQuestions, canPractice, categories, choiceCount, hintFor, makeRound, MODE_RULES, pickSession, playable, practiceLevel, practiceSession, PRACTICE_MIN, PRACTICE_SESSION, questionById, reviewSession, REVIEW_SESSION, wordsOfCat } from './quiz'
import type { WordStat } from './storage'

const DAY = 86400000
const NOW = new Date(2026, 0, 1, 12).getTime()

describe('hintFor 手がかり', () => {
  it('まちがい0回はなし、1回は選択肢を減らす、2回以上は正解を光らせる', () => {
    expect(hintFor(0)).toBe('none')
    expect(hintFor(1)).toBe('fewer')
    expect(hintFor(2)).toBe('glow')
    expect(hintFor(5)).toBe('glow')
  })

  it('fewer は選択肢を1つ減らす（最低2つ）', () => {
    expect(choiceCount(1)).toBe(2)
    expect(choiceCount(2)).toBe(3)
    expect(choiceCount(1, 'fewer')).toBe(2)
    expect(choiceCount(2, 'fewer')).toBe(2)
    expect(choiceCount(3, 'glow')).toBe(3)
  })

  it('makeRound: hint に合わせた数で、正解がかならず入る', () => {
    const q = playable[10]
    for (const [level, hint, n] of [[2, 'none', 3], [2, 'fewer', 2], [1, 'fewer', 2], [3, 'glow', 3]] as const) {
      const r = makeRound(q, level, hint, seeded(`r-${level}-${hint}`))
      expect(r.choices).toHaveLength(n)
      expect(r.choices).toContain(q.a)
      expect(new Set(r.choices).size).toBe(n)
      expect(r.hint).toBe(hint)
    }
  })
})

describe('pickSession 新しい重み', () => {
  const count = 80
  it('同じ単語は1回のプレイに1回だけ（近くに続かない）', () => {
    const s = pickSession(1, count, {}, NOW, seeded('dup'))
    expect(s).toHaveLength(count)
    expect(new Set(s.map((q) => q.id)).size).toBe(count)
    for (let i = 1; i < s.length; i++) expect(s[i].id).not.toBe(s[i - 1].id)
  })

  it('同じ乱数なら同じ並び', () => {
    const a = pickSession(2, count, {}, NOW, seeded('same')).map((q) => q.id)
    const b = pickSession(2, count, {}, NOW, seeded('same')).map((q) => q.id)
    expect(a).toEqual(b)
  })

  it('まだ出ていない単語がちゃんと出てくる（覚えたばかりの単語より多い）', () => {
    const pool = playable.filter((q) => q.l <= 1)
    // 半分は、ついさっき覚えた（期限前）単語
    const stats: Record<string, WordStat> = {}
    const fresh = new Set<string>()
    pool.forEach((q, i) => {
      if (i % 2 === 0) stats[q.id] = { ok: 1, ng: 0, last: NOW, box: 1, boxAt: NOW, due: NOW + 10 * DAY, firstOkAt: NOW }
      else fresh.add(q.id)
    })
    let unseen = 0
    let learned = 0
    for (let t = 0; t < 10; t++) {
      for (const q of pickSession(1, 60, stats, NOW, seeded(`u${t}`))) {
        if (fresh.has(q.id)) unseen++
        else learned++
      }
    }
    expect(unseen).toBeGreaterThan(learned * 3)
    expect(unseen).toBeGreaterThan(300)
  })

  it('くもりの単語は、期限前の単語よりずっと出やすい', () => {
    // レベル1の単語の半分がくもり、半分が期限前
    const pool = playable.filter((q) => q.l <= 1)
    const stats: Record<string, WordStat> = {}
    const cloudy = new Set<string>()
    const old = NOW - 100 * DAY
    pool.forEach((q, i) => {
      if (i % 2 === 0) {
        stats[q.id] = { ok: 3, ng: 0, last: old, box: 2, boxAt: old, due: old + 3 * DAY } // 期限+猶予をすぎてくもり
        cloudy.add(q.id)
      } else stats[q.id] = { ok: 3, ng: 0, last: NOW, box: 2, boxAt: NOW, due: NOW + 3 * DAY }
    })
    let hit = 0
    let total = 0
    for (let t = 0; t < 10; t++) {
      for (const q of pickSession(1, Math.floor(pool.length / 3), stats, NOW, seeded(`c${t}`))) {
        total++
        if (cloudy.has(q.id)) hit++
      }
    }
    expect(hit / total).toBeGreaterThan(0.85) // 重みなしなら 0.5
  })

  it('そのコースのレベルの新しい単語を好んで出す', () => {
    const lv = [0, 0, 0, 0]
    for (let t = 0; t < 10; t++) for (const q of pickSession(2, 60, {}, NOW, seeded(`l${t}`))) lv[q.l]++
    const ratio = (l: number) => lv[l] / playable.filter((q) => q.l === l).length
    expect(ratio(2)).toBeGreaterThan(ratio(1) * 1.4)
  })
})

describe('reviewSession ふくしゅうの出題', () => {
  const ids = playable.slice(0, 25).map((q) => q.id)

  it('review の新しいほう（後ろ）から最大10問', () => {
    const s = reviewSession(ids)
    expect(s).toHaveLength(REVIEW_SESSION)
    expect(s.map((q) => q.id)).toEqual(ids.slice(-10).reverse())
  })

  it('10問より少なければ、あるだけ', () => {
    expect(reviewSession(ids.slice(0, 3)).map((q) => q.id)).toEqual([ids[2], ids[1], ids[0]])
    expect(reviewSession([])).toEqual([])
  })

  it('存在しない id は飛ばす', () => {
    expect(reviewSession(['nothing', ids[0]]).map((q) => q.id)).toEqual([ids[0]])
    expect(questionById('nothing')).toBeUndefined()
    expect(questionById(allQuestions[0].id)).toBe(allQuestions[0])
  })
})

describe('practiceSession れんしゅうの出題', () => {
  it('決まりごと: 時間なし・ランキングなし・コースにも入れない', () => {
    expect(MODE_RULES.practice).toEqual({ timer: false, ranked: false, course: false, record: true })
  })

  it('そのカテゴリだけから10問（同じ単語は1回）', () => {
    for (const cat of ['どうぶつ', 'たべもの', 'のりもの']) {
      const s = practiceSession(cat, {}, NOW, seeded(`p-${cat}`))
      expect(s).toHaveLength(PRACTICE_SESSION)
      expect(s.every((q) => q.c === cat && (q.img || q.e))).toBe(true)
      expect(new Set(s.map((q) => q.id)).size).toBe(PRACTICE_SESSION)
    }
  })

  it('単語が10語より少ないカテゴリは あるだけ。同じ乱数なら同じ並び', () => {
    const small = categories.find((c) => wordsOfCat(c.name).length < PRACTICE_SESSION)
    if (small) expect(practiceSession(small.name, {}, NOW, seeded('s'))).toHaveLength(wordsOfCat(small.name).length)
    const a = practiceSession('どうぶつ', {}, NOW, seeded('same')).map((q) => q.id)
    expect(practiceSession('どうぶつ', {}, NOW, seeded('same')).map((q) => q.id)).toEqual(a)
    expect(practiceSession('ないカテゴリ', {})).toEqual([])
  })

  it('重み: くもり・まだ出ていない単語を、ついさっき覚えた単語より出しやすい', () => {
    const pool = wordsOfCat('どうぶつ')
    const stats: Record<string, WordStat> = {}
    const fresh = new Set<string>()
    pool.forEach((q, i) => {
      if (i % 2 === 0) stats[q.id] = { ok: 1, ng: 0, last: NOW, box: 1, boxAt: NOW, due: NOW + 10 * DAY, firstOkAt: NOW } // 覚えたばかり
      else fresh.add(q.id)
    })
    let hit = 0
    let total = 0
    for (let t = 0; t < 20; t++) {
      for (const q of practiceSession('どうぶつ', stats, NOW, seeded(`w${t}`))) {
        total++
        if (fresh.has(q.id)) hit++
      }
    }
    expect(hit / total).toBeGreaterThan(0.8) // 重みなしなら 0.5
  })

  it('?cat などのテスト用パラメータに左右されない（引数のカテゴリだけ）', () => {
    expect(practiceSession('とり', {}, NOW, seeded('x')).every((q) => q.c === 'とり')).toBe(true)
  })

  it('選択肢の難しさ: そのカテゴリの単語のレベルの最大値（1〜3）。出題の少ないカテゴリは ボタンを出さない', () => {
    for (const c of categories) {
      const lv = practiceLevel(c.name)
      expect(lv).toBeGreaterThanOrEqual(1)
      expect(lv).toBeLessThanOrEqual(3)
      expect(lv).toBe(Math.min(3, Math.max(...wordsOfCat(c.name).map((q) => q.l))))
      expect(canPractice(c.name)).toBe(wordsOfCat(c.name).length >= PRACTICE_MIN)
    }
    expect(canPractice('ないカテゴリ')).toBe(false)
    const q = wordsOfCat('どうぶつ')[0]
    expect(makeRound(q, practiceLevel('どうぶつ'), 'none', seeded('r')).choices).toHaveLength(choiceCount(practiceLevel('どうぶつ')))
  })
})
