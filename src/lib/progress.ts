// 1回遊んだ結果を進捗データに反映する（純粋な関数。保存は呼ぶ側）
import { dayKey } from './day'
import { stageUp } from './banana'
import { applyAnswer, migrate } from './leitner'
import { stickerComplete, stickerKind } from './stickers'
import type { QuizResult } from '../screens/Quiz'
import { normalizeSave, type DiaryDay, type LastResult, type Save, type WordStat } from './storage'

const DIARY_MAX = 30
const REVIEW_MAX = 30

/** 「まえより のびたよ！」の1行。text は画面の文字（親向け）、speech は読み上げ */
export type GrowthLine = { text: string; speech: string }

export type ResultEvents = {
  /** 新しく☆1になった単語 */
  newMastered: string[]
  /** 段が上がった単語 [id, 新しい段] */
  starUps: [string, number][]
  /** くもりをみがいた単語 */
  polished: string[]
  /** その日はじめて遊び終わった */
  firstPlayToday: boolean
  /** その日はじめて遊び終わってもらったシール。kind: 種類 0〜6、count: もらった枚数（今回ぶんを含む）、complete: 7枚そろった */
  sticker: { kind: number; count: number; complete: boolean } | null
  /** バナナの段階が上がったとき、新しい段階（0〜6）。変わらなければ null */
  bananaUp: number | null
  /** 同じコースの前回より のびた項目（最大3行。のびていなければ空） */
  growth: GrowthLine[]
}

const fmtTime = (ms: number) => {
  const sec = Math.floor(ms / 1000)
  return `${Math.floor(sec / 60)}ふん${String(sec % 60).padStart(2, '0')}びょう`
}

/** 同じコースの前回と比べて、のびた項目だけを返す（せいかい数・さいこうれんぞく・クリアタイムが短く）。前回がなければ空 */
export function growthLines(prev: LastResult | undefined, cur: Pick<LastResult, 'correct' | 'bestCombo' | 'clearMs'>, level: number): GrowthLine[] {
  if (!prev || prev.level !== level) return []
  const out: GrowthLine[] = []
  if (cur.correct > prev.correct) out.push({ text: `せいかい ${prev.correct} → ${cur.correct}`, speech: 'せいかいが、ふえたよ！' })
  if (cur.bestCombo > prev.bestCombo) out.push({ text: `れんぞく ${prev.bestCombo} → ${cur.bestCombo}`, speech: 'れんぞくが、のびたよ！' })
  if (cur.clearMs !== undefined && prev.clearMs !== undefined && cur.clearMs < prev.clearMs) {
    out.push({ text: `くりあたいむ ${fmtTime(prev.clearMs)} → ${fmtTime(cur.clearMs)}`, speech: 'くりあたいむが、はやくなったよ！' })
  }
  return out.slice(0, 3)
}

/** 単語ごとの「最初の答え」の正誤。同じ問題はまちがえるとあとでもう一度出るので、最初に出てきたものだけ見る */
export function firstAnswers(answers: QuizResult['answers']): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const a of answers) if (!m.has(a.id)) m.set(a.id, a.ok)
  return m
}

const addUnique = (list: string[], ids: string[]) => [...list, ...ids.filter((id) => !list.includes(id))]

/** 結果を反映した新しい Save と、今回あったこと。review はふくしゅうモードか */
export function applyResult(input: Save, result: QuizResult, nowMs: number, level: number, review = false): { save: Save; events: ResultEvents } {
  const save = normalizeSave(input) // 古いデータ（lastByLevel がない）でも同じに扱う
  const events: ResultEvents = { newMastered: [], starUps: [], polished: [], firstPlayToday: false, sticker: null, bananaUp: null, growth: [] }
  const first = firstAnswers(result.answers)

  // 単語ごとの記録（ok/ng は全部の答えを数える。箱は最初の答えだけ）
  const stats: Record<string, WordStat> = { ...save.stats }
  const counts = new Map<string, { ok: number; ng: number }>()
  for (const a of result.answers) {
    const c = counts.get(a.id) ?? { ok: 0, ng: 0 }
    if (a.ok) c.ok++
    else c.ng++
    counts.set(a.id, c)
  }
  for (const [id, c] of counts) {
    const old = migrate(stats[id] ?? { ok: 0, ng: 0, last: 0 }) // 古い ok/ng から段を決めてから数える
    const counted: WordStat = { ...old, ok: old.ok + c.ok, ng: old.ng + c.ng, last: nowMs }
    const r = applyAnswer(counted, first.get(id) === true, nowMs)
    stats[id] = r.stat
    if (r.events.mastered) events.newMastered.push(id)
    if (r.events.starUp !== null) events.starUps.push([id, r.events.starUp])
    if (r.events.polished) events.polished.push(id)
  }

  // えにっき: その日あてた単語（最大30）と遊んだ回数
  const day = dayKey(nowMs)
  const today = save.diary[day]
  events.firstPlayToday = !today
  const got = [...new Set(result.answers.filter((a) => a.ok).map((a) => a.id))]
  const words = addUnique(today?.words ?? [], got).slice(0, DIARY_MAX)
  const mastered = addUnique(today?.mastered ?? [], events.newMastered).slice(0, DIARY_MAX) // ☆1になった日がその日のもの
  const day1: DiaryDay = { words, plays: (today?.plays ?? 0) + 1, mastered }
  // シール: その日はじめて遊び終わったら1枚（ふくしゅうでも）。種類は もらった枚数で順番に決まる（休んでも続きから）
  let stickers = save.stickers
  if (events.firstPlayToday) {
    stickers++
    day1.sticker = stickerKind(stickers)
    events.sticker = { kind: day1.sticker, count: stickers, complete: stickerComplete(stickers) }
  } else if (today?.sticker !== undefined) day1.sticker = today.sticker
  const diary = { ...save.diary, [day]: day1 }

  // ふくしゅう: 最初の答えでまちがえた単語。ふくしゅうモードで最初に正解したら外す
  const missed = [...first].filter(([, ok]) => !ok).map(([id]) => id)
  const solved = review ? new Set([...first].filter(([, ok]) => ok).map(([id]) => id)) : new Set<string>()
  const reviewList = addUnique(save.review, missed).filter((id) => !solved.has(id)).slice(-REVIEW_MAX)

  // ふくしゅうは、コースのクリア（解放）にも「まえより」の記録にも入れない
  const cleared = !review && result.cleared && !save.cleared.includes(level) ? [...save.cleared, level] : save.cleared
  const last: LastResult = { correct: result.correct, bestCombo: result.bestCombo, clearMs: result.clearMs, level, at: nowMs }
  if (!review) events.growth = growthLines(save.lastByLevel[level], last, level)
  const next: Save = {
    ...save,
    coins: save.coins + result.coins,
    stickers,
    bestCombo: Math.max(save.bestCombo, result.bestCombo),
    plays: save.plays + 1,
    cleared,
    stats,
    diary,
    review: reviewList,
    ...(review ? {} : { lastResult: last, lastByLevel: { ...save.lastByLevel, [level]: last } }),
  }
  events.bananaUp = stageUp(save.coins, next.coins)
  return { save: next, events }
}
