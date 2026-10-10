// 演出の再生。Quiz などはここだけを呼ぶ
import { getMotion } from '../lib/settings'
import { rng } from '../lib/rng'
import { sfx } from '../lib/sound'
import { speak } from '../lib/speech'
import type { Question } from '../lib/quiz'
import { getShow, ownedIn, pickShow, ugokuFor } from './registry'
import type { Show, ShowCat, ShowCtx, UnlockCtx } from './types'
import { makeLayer } from './layer'

export { attachLayer, layer } from './layer'
export { SHOWS, getShow, isUnlocked, ownedIn, pickShow, ugokuFor } from './registry'
export { unlockCtx } from './unlock'
export { BOOK_CATS, bookCounts, grantShows, isOwned, newlyUnlocked, showsOf } from './book'
export { peekaboo } from './peekaboo'
export { LANDMARKS, crossed, roadX, skyStage, themeOf } from './michi'
export type { MichiTheme, SkyStage } from './michi'
export { reachFor, shouldAnnounce } from './reach'
export type { Show, ShowCat, ShowCtx, UnlockCtx } from './types'

/** ?show=<id> で指定された演出（テスト用） */
export function forcedShow(): Show | undefined {
  if (typeof location === 'undefined') return undefined
  const id = new URLSearchParams(location.search).get('show')
  return id ? getShow(id) : undefined
}

/** 今の場面の材料から ShowCtx を作る（pic / host は、渡されなければ画面から探す。図鑑の舞台は自分の要素を渡す） */
export function makeCtx(p: { q?: Question; E?: number; heat?: number; at?: { x: number; y: number }; combo?: number; today?: Question[]; pic?: HTMLElement | null; host?: HTMLElement | null; preview?: boolean }): ShowCtx {
  const motion = getMotion()
  const layer = makeLayer() // この演出ぶんの層（次の問題で clear されたら、あとから何も置かない）
  layer.motion = motion
  return {
    layer,
    pic: p.pic !== undefined ? p.pic : document.querySelector<HTMLElement>('.picture'),
    host: p.host !== undefined ? p.host : document.querySelector<HTMLElement>('.host-monkey'),
    q: p.q,
    E: p.E ?? 0,
    heat: p.heat ?? 0,
    motion,
    rng,
    speak,
    sfx,
    at: p.at,
    combo: p.combo,
    today: p.today,
    preview: p.preview,
  }
}

/** 正解のとき使ううごくえ。?show で ugoku の演出が指定されていればそれを必ず使う */
export function chooseUgoku(catName: string, u: UnlockCtx): Show {
  const f = forcedShow()
  return f && f.cat === 'ugoku' ? f : ugokuFor(catName, u)
}

/** まちがえたとき使うずっこけ。直前と同じものが続かないようにする */
export function chooseZukkoke(pick: Record<string, string>, u: UnlockCtx, avoid?: string): Show {
  const f = forcedShow()
  return f && f.cat === 'zukkoke' ? f : (pickShow('zukkoke', pick, u, rng, avoid) ?? getShow('zukkoke:slip')!)
}

/** みちのり・おんがくなど、うごくえ・ずっこけ以外の演出を選ぶ。?show=<id> でそのカテゴリの演出が指定されていればそれを使う */
export function chooseShow(cat: ShowCat, pick: Record<string, string>, u: UnlockCtx): Show {
  const f = forcedShow()
  return f && f.cat === cat ? f : (pickShow(cat, pick, u, rng) ?? ownedIn(cat, u)[0])
}

/** 演出を再生する（id か Show）。終わったら resolve。失敗しても遊びは止めない */
export async function play(arg: string | Show, ctx: ShowCtx): Promise<void> {
  const show = typeof arg === 'string' ? getShow(arg) : arg
  if (!show) return
  try {
    await show.play(ctx)
  } catch (e) {
    console.warn('show failed', show.id, e)
  }
}
