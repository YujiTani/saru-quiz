// 保護者メニューの集計と、記録を消す処理（純粋な関数）。画面は screens/Parent.tsx
import { dayKey } from './day'
import { isCloudy, starsOf } from './leitner'
import { playable, questionById, type Question } from './quiz'
import { emptySave, type Save, type WordStat } from './storage'

type Stats = Record<string, WordStat>

export type PlaySummary = { /** 遊んだ日数 */ days: number; /** おぼえた単語 */ learned: number; /** ☆の合計 */ stars: number; cloudy: number; /** 合計の正解数 */ correct: number; /** 遊んだ回数 */ plays: number }

/** このキャラの記録のまとめ */
export function playSummary(save: Save, nowMs: number): PlaySummary {
  const list = Object.values(save.stats)
  return {
    days: Object.values(save.diary).filter((d) => d.plays > 0).length,
    learned: list.filter((s) => starsOf(s) >= 1).length,
    stars: list.reduce((a, s) => a + starsOf(s), 0),
    cloudy: list.filter((s) => isCloudy(s, nowMs)).length,
    correct: list.reduce((a, s) => a + s.ok, 0),
    plays: save.plays,
  }
}

/** 最近 days 日に遊んだ回数（古い日が先、今日が最後） */
export function recentPlays(save: Save, nowMs: number, days = 7): { day: string; plays: number }[] {
  const t = new Date(nowMs)
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - (days - 1 - i), 12).getTime())
    return { day, plays: save.diary[day]?.plays ?? 0 }
  })
}

export type Trouble = { q: Question; ok: number; ng: number }

/** にがてな ことば: まちがい（ng）が多い順に最大 max 語。同じなら 正解（ok）が少ないほうが先 */
export function troubleWords(stats: Stats, max = 10): Trouble[] {
  const out: Trouble[] = []
  for (const [id, s] of Object.entries(stats)) {
    const q = questionById(id)
    if (q && s.ng > 0) out.push({ q, ok: s.ok, ng: s.ng })
  }
  out.sort((a, b) => b.ng - a.ng || a.ok - b.ok || a.q.id.localeCompare(b.q.id))
  return out.slice(0, max)
}

/** 記録のある単語（消す相手の候補）。cat が空ならぜんぶ。query は こたえの一部（ひらがな） */
export function recordedWords(stats: Stats, query = '', cat = ''): Question[] {
  const text = query.trim()
  return playable.filter((q) => !!stats[q.id] && (!cat || q.c === cat) && (!text || q.a.includes(text)))
}

/** 1語の記録を消す（stats・ふくしゅうから外す。☆もくもりも なくなる）。えにっきの記録は そのまま */
export function clearWord(save: Save, id: string): Save {
  const stats = { ...save.stats }
  delete stats[id]
  return { ...save, stats, review: save.review.filter((r) => r !== id) }
}

/** このキャラの記録をぜんぶ消す（キャラの名前・見た目は Player のほうにあるので残る） */
export const clearAll = (): Save => emptySave()
