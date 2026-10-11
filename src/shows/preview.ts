// 図鑑の「ためす」とプレゼントの再生。小さなクイズの舞台（司会のおさる・絵のカード）に演出を1回だけ流す
import { songOf } from '../lib/bgm'
import { allQuestions, playable, type Question } from '../lib/quiz'
import { sfx, setBgmLevel, startBgm, stopBgm } from '../lib/sound'
import { makeCtx, play } from './index'
import type { Show } from './types'
import { wait } from './util'

/** うごくえの見本の単語（id）。天気や楽器のように単語で動きが変わるものは、1つずつ順番に見せる */
const SAMPLES: Record<string, string[]> = {
  'ugoku:tenki': ['rain', 'snow', 'rainbow', 'sun', 'lightning', 'wind'],
  'ugoku:gakki': ['drum', 'piano', 'trumpet', 'jingle-bell', 'guitar'],
}

const byId = new Map(allQuestions.map((q) => [q.id, q]))
const withArt = (list: Question[]) => list.filter((q) => q.img)

/**
 * 「ためす」で舞台のカードに入れる単語。うごくえは そのカテゴリの絵、ほかは どうぶつの絵。
 * n（何回目か）で ちがう単語になる（同じ演出でも 見えかたが変わる）。かならず絵のある単語を返す
 */
export function previewWord(show: Show | null | undefined, n = 0): Question {
  const pool = show?.forCat ? withArt(playable.filter((q) => q.c === show.forCat)) : withArt(playable.filter((q) => q.c === 'どうぶつ'))
  const wanted = show ? (SAMPLES[show.id] ?? []).map((id) => byId.get(id)).filter((q): q is Question => !!q) : []
  const list = wanted.length > 0 ? wanted : pool.slice(0, 6)
  return list[Math.abs(n) % list.length] ?? playable[0]
}

/** きねんしゃしんなど「今日のことば」を使う演出のための見本（絵のある8語） */
export const sampleToday = (): Question[] => withArt(playable.filter((q) => q.c === 'どうぶつ')).slice(0, 8)

/** 途中でやめたいとき cancelled を true にする（舞台がなくなる・次の再生が始まる） */
export type Cancel = { cancelled: boolean }
export type PreviewEls = { host: HTMLElement | null; pic: HTMLElement | null }
/** E: みちのり・おんがくの進み具合（舞台が Road や おさるバンドの表示に使う）、GOAL: みちのりの1周のこたえ数 */
export type PreviewHooks = {
  setE?: (E: number) => void
  /** おうえんの舞台の観客（E・正解の数）。null で消す */
  setCheer?: (c: { E: number; correct: number } | null) => void
}

const CHEER_STEPS = 8
const CHEER_MS = 650

export const ROAD_GOAL = 20
const ROAD_MS = 6000
const SONG_MS = 7000

/** みちのりの E の進みかた（0→1。ms 経過での値） */
export const roadE = (ms: number) => Math.max(0, Math.min(1, ms / ROAD_MS))
/** おんがくの E（0→1 を 7 秒で。楽器が1つずつ重なっていく） */
export const songE = (ms: number) => Math.max(0, Math.min(1, ms / SONG_MS))

/** 演出を舞台で1回再生する。終わったら resolve（cancelled なら すぐ終わる） */
export async function runPreview(show: Show, els: PreviewEls, word: Question, hooks: PreviewHooks, cancel: Cancel): Promise<void> {
  if (show.cat === 'michi') {
    // みちのり: その道の上を、おさるが 0 → 1 まで歩く
    const t0 = performance.now()
    while (!cancel.cancelled) {
      const ms = performance.now() - t0
      hooks.setE?.(roadE(ms))
      if (ms >= ROAD_MS) break
      await wait(250)
    }
    return
  }
  if (show.cat === 'ongaku') {
    // おんがく: 7秒だけ鳴らす。E を少しずつ上げて、楽器が重なるのを聞かせる
    startBgm(songOf(show.id), 0)
    const t0 = performance.now()
    try {
      while (!cancel.cancelled) {
        const ms = performance.now() - t0
        const E = songE(ms)
        setBgmLevel(E)
        hooks.setE?.(E)
        if (ms >= SONG_MS) break
        await wait(200)
      }
    } finally {
      stopBgm()
    }
    return
  }
  if (show.cat === 'ouen') {
    // おうえん: 正解が進むようすを見せる（E が 0 → 1。おさるが増える・ことりは1つ正解するたびに音階が上がる）
    try {
      for (let i = 0; i < CHEER_STEPS && !cancel.cancelled; i++) {
        hooks.setCheer?.({ E: i / (CHEER_STEPS - 1), correct: i + 1 })
        if (show.id === 'ouen:kotori') sfx.chirp(i)
        await wait(CHEER_MS)
      }
      if (!cancel.cancelled) await wait(1200)
    } finally {
      hooks.setCheer?.(null)
    }
    return
  }
  // ほかは、その演出の play をそのまま呼ぶ（吹き出しの言葉も読み上げる）
  const ctx = makeCtx({ q: word, E: 0.5, heat: 0, combo: 1, pic: els.pic, host: els.host, preview: true, today: sampleToday() })
  await play(show, ctx)
}
