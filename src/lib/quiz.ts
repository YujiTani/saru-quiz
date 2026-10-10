import data from '../data/questions.json'
import { now } from './day'
import { weight as stepWeight } from './leitner'
import { rng, type Rng } from './rng'
import type { WordStat } from './storage'
import { catParam, wordParam } from './testflags'

export type Question = { id: string; a: string; c: string; l: number; img?: string; e?: string }
export type Round = { q: Question; choices: string[]; hint: Hint }

/** 遊びかた。あとで 'practice'（れんしゅう）と 'demo' も足す。決まりごとは MODE_RULES に書く */
export type Mode = 'course' | 'review'
export const MODE_RULES: Record<Mode, { timer: boolean; ranked: boolean; course: boolean }> = {
  // timer: 時間ゲージがある / ranked: ランキングに送る / course: コースのクリア・「まえより」の記録に入る
  course: { timer: true, ranked: true, course: true },
  review: { timer: false, ranked: false, course: false },
}

/** ふくしゅうで出す最大の問題数 */
export const REVIEW_SESSION = 10
/** ふくしゅうモードの選択肢の数・難しさ（コースに関係なく ふつう と同じ） */
export const REVIEW_LEVEL = 2

/** 手がかり: 1回のプレイの中で、その単語をまちがえた回数から決める */
export type Hint = 'none' | 'fewer' | 'glow'
export function hintFor(misses: number): Hint {
  return misses >= 2 ? 'glow' : misses === 1 ? 'fewer' : 'none'
}

/** コースごとの制限時間（秒）と、クリアになる正解数 */
export const COURSE: Record<number, { name: string; time: number; goal: number }> = {
  1: { name: 'かんたん', time: 45, goal: 50 },
  2: { name: 'ふつう', time: 30, goal: 55 },
  3: { name: 'むずかしい', time: 20, goal: 60 },
}

export const categories: { name: string; icon: string }[] = data.categories
export const allQuestions: Question[] = data.questions

/** 画像か仮の絵文字があって出題できるもの */
export const playable = allQuestions.filter((q) => q.img || q.e)

const shuffle = <T,>(arr: T[], random: Rng = rng): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const byId = new Map(allQuestions.map((q) => [q.id, q]))
export const questionById = (id: string): Question | undefined => byId.get(id)

/**
 * 出題を選ぶ。重みは leitner.weight（くもり=多い / まだ出ていない / 期限前=少ない）に、
 * そのコースのレベルの新しい単語を2倍する好みをかけ合わせる。同じ単語は1回のプレイに1回だけ。
 * 重みつきの抽選（u^(1/w) の大きい順）で選んでから、並びはシャッフルする
 */
export function pickSession(level: number, count: number, stats: Record<string, WordStat>, nowMs: number = now(), random: Rng = rng): Question[] {
  // ?cat=カテゴリ名 のときは、そのカテゴリだけ（テスト用）
  const cat = catParam()
  const word = wordParam()
  const byCat = word ? playable.filter((q) => q.id === word) : cat ? playable.filter((q) => q.c === cat) : []
  const pool = byCat.length > 0 ? byCat : playable.filter((q) => q.l <= level)
  const w = (q: Question) => {
    const s = stats[q.id]
    return stepWeight(s, nowMs) * (!s && q.l === level ? 2 : 1)
  }
  const scored = pool.map((q) => ({ q, k: Math.pow(random(), 1 / w(q)) }))
  scored.sort((x, y) => y.k - x.k)
  return shuffle(scored.slice(0, count).map((s) => s.q), random)
}

/** ふくしゅうの出題: review の新しいほう（後ろ）から最大 max 問。絵のない単語は飛ばす */
export function reviewSession(review: string[], max: number = REVIEW_SESSION): Question[] {
  const out: Question[] = []
  for (let i = review.length - 1; i >= 0 && out.length < max; i--) {
    const q = byId.get(review[i])
    if (q && (q.img || q.e) && !out.includes(q)) out.push(q)
  }
  return out
}

/** 選択肢の数。コース1は2つ、ほかは3つ。手がかり fewer は1つ減らす（最低2つ） */
export function choiceCount(level: number, hint: Hint = 'none'): number {
  const n = level === 1 ? 2 : 3
  return hint === 'fewer' ? Math.max(2, n - 1) : n
}

/** 同じカテゴリから誤答をえらぶ（足りなければ全体から） */
export function makeRound(q: Question, level: number, hint: Hint = 'none', random: Rng = rng): Round {
  const n = choiceCount(level, hint)
  const others = (list: Question[]) => shuffle(list.filter((o) => o.a !== q.a && o.l <= level + 1), random).map((o) => o.a)
  const same = others(playable.filter((o) => o.c === q.c))
  const any = others(playable)
  const wrong = [...new Set([...same, ...any])].slice(0, n - 1)
  return { q, choices: shuffle([q.a, ...wrong], random), hint }
}
