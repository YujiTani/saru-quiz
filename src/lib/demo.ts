// デモプレイ（おさるが自動で10問あそぶ）の決めごと。純粋な関数と定数だけ（画面は Quiz / Result）
import { playable, type Question } from './quiz'
import { rng, type Rng } from './rng'

export const DEMO_GOAL = 10
/** 読み上げが終わってから、答えはじめるまで待つ時間 */
export const DEMO_THINK_MS = 800
/** デモが始まってから、この間のタップは無視する（始めるときのタップが残らないように） */
export const DEMO_IGNORE_TAP_MS = 600
/** 結果が出てから、自動でタイトルに戻るまで */
export const DEMO_BACK_MS = 3000
/** 正解のたび、ねつを少し多めに上げる（10問でフィーバーに入るように） */
export const DEMO_HEAT_BONUS = 12
/** デモで見せる演出（手に入れていなくても見せる。ランダムにしない） */
export const DEMO_SHOWS = {
  michi: 'michi:umi',
  ongaku: 'ongaku:matsuri',
  ouen: 'ouen:osaru',
  deteku: ['deteku:kurutto', 'deteku:shabon', 'deteku:present', 'deteku:ki', 'deteku:tsuchi'],
  zukkoke: ['zukkoke:hiyoko', 'zukkoke:hakushon'],
  finale: 'finale:rocket',
  /** ハプニング（5問目の読み上げ中） */
  hap: { id: 'hap:niji', at: 5 },
} as const

/** そのモードの結果を保存するか（テスト用のURLでも保存しない）。デモは何も記録しない */
export function shouldRecord(rules: { record: boolean }, testRun: boolean): boolean {
  return rules.record && !testRun
}

/** わざとまちがえる問題の番号（0から）。goal 問のうち count 問、はじめと終わりをさけて、まんなかに間をあけて並べる */
export function demoWrongIndices(goal: number = DEMO_GOAL, count: number = 2): number[] {
  const lo = 2
  const hi = Math.max(lo, goal - 3)
  if (count <= 1) return [Math.round((lo + hi) / 2)].slice(0, count)
  return Array.from({ length: count }, (_, i) => Math.round(lo + ((hi - lo) * i) / (count - 1)))
}

/** この番号の問題を、わざとまちがえるか（まちがえたあとに出なおす同じ問題は、ちゃんと正解する） */
export function isDemoWrong(index: number, alreadyMissed: boolean, goal: number = DEMO_GOAL): boolean {
  return !alreadyMissed && demoWrongIndices(goal).includes(index)
}

/** デモの出題: かんたん（レベル1）の絵のある問題から、カテゴリがばらばらになるように count 問（多めに返して、まちがえの出なおしにそなえる） */
export function demoSession(count: number = DEMO_GOAL + 2, random: Rng = rng): Question[] {
  const pool = playable.filter((q) => q.l <= 1 && q.img)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const used = new Set<string>()
  const out: Question[] = []
  for (const q of shuffled) {
    if (used.has(q.c)) continue
    used.add(q.c)
    out.push(q)
    if (out.length >= count) return out
  }
  for (const q of shuffled) {
    if (out.length >= count) break
    if (!out.includes(q)) out.push(q)
  }
  return out
}
