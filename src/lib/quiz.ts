import data from '../data/questions.json'
import type { WordStat } from './storage'

export type Question = { id: string; a: string; c: string; l: number; img?: string; e?: string }
export type Round = { q: Question; choices: string[] }

/** コースごとの制限時間（秒）と、クリアになる正解数 */
export const COURSE: Record<number, { name: string; time: number; goal: number }> = {
  1: { name: 'かんたん', time: 45, goal: 100 },
  2: { name: 'ふつう', time: 30, goal: 120 },
  3: { name: 'むずかしい', time: 20, goal: 150 },
}

export const categories: { name: string; icon: string }[] = data.categories
export const allQuestions: Question[] = data.questions

/** 画像か仮の絵文字があって出題できるもの */
export const playable = allQuestions.filter((q) => q.img || q.e)

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** まだ出ていない・まちがえた単語を優先して出題を選ぶ */
export function pickSession(level: number, count: number, stats: Record<string, WordStat>): Question[] {
  const pool = playable.filter((q) => q.l <= level)
  const weight = (q: Question) => {
    const s = stats[q.id]
    if (!s) return q.l === level ? 6 : 3
    return 1 + s.ng * 3 - Math.min(s.ok, 3) * 0.3
  }
  const scored = pool.map((q) => ({ q, k: Math.random() * Math.max(weight(q), 0.2) }))
  scored.sort((x, y) => y.k - x.k)
  return scored.slice(0, count).map((s) => s.q)
}

/** 同じカテゴリから誤答をえらぶ（足りなければ全体から） */
export function makeRound(q: Question, level: number): Round {
  const n = level === 1 ? 2 : 3
  const others = (list: Question[]) => shuffle(list.filter((o) => o.a !== q.a && o.l <= level + 1)).map((o) => o.a)
  const same = others(playable.filter((o) => o.c === q.c))
  const any = others(playable)
  const wrong = [...new Set([...same, ...any])].slice(0, n - 1)
  return { q, choices: shuffle([q.a, ...wrong]) }
}
