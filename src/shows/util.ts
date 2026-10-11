// 演出のくみたてに使う小さな道具
import { burst } from '../lib/effects'
import type { ShowCtx } from './types'

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 問題の絵（img か 仮の絵文字）。.picture の中にある */
export const artOf = (pic: HTMLElement | null) => pic?.querySelector<HTMLElement>('img, .emoji') ?? null

export const centerOf = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

/** 司会のおさるの位置（なければ左上あたり） */
export function hostRect(ctx: ShowCtx): DOMRect {
  return ctx.host?.getBoundingClientRect() ?? new DOMRect(30, 110, 60, 70)
}

/** 司会のおさるの「ふきだし」のすぐ右（「おしい！」などの吹き出しと重ならない場所）。ここに出す吹き出しの中心 */
export function besideHost(ctx: ShowCtx, gap = 70): { x: number; y: number } {
  const r = ctx.host?.parentElement?.getBoundingClientRect() ?? new DOMRect(16, 110, 190, 70)
  return { x: r.right + gap, y: r.top + r.height * 0.4 }
}

/** 司会のおさる本体の画像（回したりするときはこちらを動かす） */
export const monkeyOf = (ctx: ShowCtx): Element | null => ctx.host?.querySelector('img.monkey') ?? ctx.host

export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** 動きの1コマ。x,y は px, r は度, s は拡大率, o は透明度, f は filter */
export type Pose = { x?: number; y?: number; r?: number; s?: number; sx?: number; sy?: number; o?: number; f?: string }

/** 時間 t(0〜1) から姿勢を返す関数を、n 個のキーフレームにする（直線でつなぐ） */
export function track(n: number, f: (t: number) => Pose): Keyframe[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const p = f(t)
    const k: Keyframe = { offset: t, transform: `translate(${p.x ?? 0}px, ${p.y ?? 0}px) rotate(${p.r ?? 0}deg) scale(${p.sx ?? p.s ?? 1}, ${p.sy ?? p.s ?? 1})` }
    if (p.o !== undefined) k.opacity = p.o
    if (p.f !== undefined) k.filter = p.f
    return k
  })
}

/** 演出の中心（正解した選択肢の位置 → なければ絵の中心 → 画面の中心） */
export function spot(ctx: ShowCtx): { x: number; y: number } {
  if (ctx.at) return ctx.at
  const art = artOf(ctx.pic)
  if (art) return centerOf(art.getBoundingClientRect())
  return { x: innerWidth / 2, y: innerHeight / 2 }
}

/** 正解の「はじける・コイン」（今までの正解の演出。見た目は変えない） */
export function pop(ctx: ShowCtx) {
  const { x, y } = spot(ctx)
  const c = ctx.combo ?? 1
  burst(x, y, 'confetti', 60)
  burst(x, y, 'coin', 8 + Math.min(c, 10) * 2, 0.9)
}

/** 絵の複製を作り、元の絵はその間だけ透明にする。body が終わったら複製を消して元に戻す */
export async function withClone(ctx: ShowCtx, body: (clone: HTMLElement, from: DOMRect) => Promise<void>): Promise<void> {
  const art = artOf(ctx.pic)
  if (!art) return
  const from = art.getBoundingClientRect()
  const clone = ctx.layer.cloneOf(art)
  const restore = () => {
    art.style.opacity = ''
  }
  // 動きの強さ0のときは元の絵を残し、その上でふわっと光るだけにする
  if (ctx.motion > 0) {
    art.style.opacity = '0'
    ctx.layer.defer(restore)
  }
  try {
    await body(clone, from)
  } finally {
    clone.remove()
    restore()
  }
}

/** ことばの吹き出し（ぱくっ・ぽんっ！ など）。(x,y) が中心 */
export function bubbleText(ctx: ShowCtx, text: string, x: number, y: number, ms = 900): Promise<void> {
  const el = document.createElement('div')
  el.className = 'show-bubble'
  el.textContent = text
  ctx.layer.add(el, { x, y })
  return ctx.layer.go(el, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.2 }, { opacity: 1, transform: 'scale(1)', offset: 0.8 }, { opacity: 0, transform: 'scale(1)' }], { duration: ms }, true)
}

/** 吹き出し＋（図鑑の「ためす」のときだけ）読み上げ。voice_lines.py に同じ言葉を足しておく */
export function say(ctx: ShowCtx, text: string, x: number, y: number, ms = 900): Promise<void> {
  if (ctx.preview) void ctx.speak(text)
  return bubbleText(ctx, text, x, y, ms)
}

/** 土けむり（茶色の丸） */
export function dust(ctx: ShowCtx, x: number, y: number, size: number) {
  const el = document.createElement('div')
  el.className = 'show-puff dust'
  Object.assign(el.style, { width: `${size}px`, height: `${size}px` })
  ctx.layer.add(el, { x, y })
  void ctx.layer.go(el, [{ opacity: 0.85, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.7) translateY(-12px)' }], { duration: 700, easing: 'ease-out' }, true)
}

/** 画面全体にうすく色をかける（天気など）。ms のあいだに出て、消える。動きの強さ 0 のときは かけない */
export function tint(ctx: ShowCtx, color: string, ms: number, peak = 1) {
  if (ctx.motion <= 0) return // 動きの強さ 0 のときは かけない
  const el = document.createElement('div')
  el.className = 'show-tint'
  el.style.background = color
  ctx.layer.add(el)
  el.style.inset = '0'
  void ctx.layer.go(el, [{ opacity: 0 }, { opacity: peak, offset: 0.2 }, { opacity: peak, offset: 0.8 }, { opacity: 0 }], { duration: ms, easing: 'ease-in-out' }, true)
}

/** 白いけむりの丸 */
export function puff(ctx: ShowCtx, x: number, y: number, size: number) {
  const el = document.createElement('div')
  el.className = 'show-puff'
  Object.assign(el.style, { width: `${size}px`, height: `${size}px` })
  ctx.layer.add(el, { x, y })
  void ctx.layer.go(el, [{ opacity: 0.9, transform: 'scale(.5)' }, { opacity: 0, transform: 'scale(1.9) translateY(-14px)' }], { duration: 650, easing: 'ease-out' }, true)
}

/** 一定間隔でなにかする。止める関数を返す（片づけにも登録する） */
export function every(ctx: ShowCtx, ms: number, f: () => void): () => void {
  const id = setInterval(f, ms)
  const stop = () => clearInterval(id)
  ctx.layer.defer(stop)
  return stop
}
