// でてくる: 問題の絵（.picture）の出かた。遊び始めに1つ選んで、そのプレイのあいだ ずっと同じものを使う
// 読み上げは止めない。どれも 0.8 秒以内。E（進み具合）が上がるほど、はねる高さ・粒の数がふえる
import { burst, drift } from '../lib/effects'
import type { Show, ShowCtx } from './types'
import { centerOf, dust, ease, track } from './util'

/** 演出の長さ（ms）。0.8秒以内 */
export const DETEKU_MS = 780

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const sin = Math.sin
const PI = Math.PI

/** 時間をおいて何かする（片づけられたら やめる） */
function later(ctx: ShowCtx, ms: number, f: () => void) {
  const t = setTimeout(f, ms)
  ctx.layer.defer(() => clearTimeout(t))
}

/** 動きの強さ 0: 絵がふわっと出るだけ */
function fadeIn(ctx: ShowCtx): Promise<void> {
  const pic = ctx.pic
  if (!pic) return Promise.resolve()
  const a = pic.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' })
  return a.finished.then(
    () => {},
    () => {},
  )
}

/** 絵を動かす（pic の WAAPI。clear() で止まる）。fill なし: 終わったら もとの見た目 */
const move = (ctx: ShowCtx, kf: Keyframe[], duration = DETEKU_MS) => (ctx.pic ? ctx.layer.go(ctx.pic, kf, { duration, easing: 'linear' }) : Promise.resolve())

/** くるっと（はじめから）: 絵が くるっと回って、ぽんっと出る（もとの「picture-in」と同じ動き。テンポを落とさない短さ） */
export const KURUTTO_MS = 450
const kurutto: Show = {
  id: 'deteku:kurutto',
  cat: 'deteku',
  name: 'くるっと',
  icon: '🔄',
  base: true,
  async play(ctx) {
    if (!ctx.pic) return
    if (ctx.motion <= 0) return fadeIn(ctx)
    const bounce = 'cubic-bezier(0.2, 1.6, 0.4, 1)' // CSS の picture-in と同じ（区間ごとに かかる）
    await move(
      ctx,
      [
        { transform: 'perspective(600px) rotateY(180deg) scale(0.4)', opacity: 0, easing: bounce },
        { transform: 'perspective(600px) rotateY(-12deg) scale(1.05)', opacity: 1, offset: 0.6, easing: bounce },
        { transform: 'none', opacity: 1 },
      ],
      KURUTTO_MS,
    )
  },
}

/** プレゼントの箱から出る: 🎁 がぶるぶるゆれて、ぽんっとひらくと 絵がとびだす */
const present: Show = {
  id: 'deteku:present',
  cat: 'deteku',
  name: 'プレゼントのはこ',
  icon: '🎁',
  hint: 'コースを 3かい あそぶ',
  unlock: (u) => u.plays >= 3,
  async play(ctx) {
    const pic = ctx.pic
    if (!pic) return
    if (ctx.motion <= 0) return fadeIn(ctx)
    const r = pic.getBoundingClientRect()
    const c = centerOf(r)
    const size = Math.min(r.width, r.height) * 0.5
    const box = ctx.layer.emoji('🎁', c.x, c.y, size)
    void ctx.layer.go(
      box,
      track(26, (t) => {
        if (t < 0.12) return { s: 0.4 + (t / 0.12) * 0.6, o: 1 }
        if (t < 0.46) return { r: 9 * sin(((t - 0.12) / 0.34) * 6 * PI), s: 1, o: 1 }
        return { s: 1 + 0.9 * ease((t - 0.46) / 0.54), o: 1 - ease((t - 0.46) / 0.54), y: -size * 0.1 * ((t - 0.46) / 0.54) }
      }),
      { duration: DETEKU_MS, easing: 'linear' },
      true,
    )
    later(ctx, DETEKU_MS * 0.46, () => {
      ctx.sfx.openBox()
      burst(c.x, c.y, 'confetti', Math.round(16 + 36 * ctx.E), 0.9)
      burst(c.x, c.y, 'star', Math.round(6 + 10 * ctx.E), 0.7)
    })
    const over = 1.1 + 0.1 * ctx.E
    await move(ctx, [
      { opacity: 0, transform: 'scale(.2)', offset: 0 },
      { opacity: 0, transform: 'scale(.2)', offset: 0.46 },
      { opacity: 1, transform: `scale(${over})`, offset: 0.78 },
      { opacity: 1, transform: 'scale(1)', offset: 1 },
    ])
  },
}

/** 木から落ちてくる: 上から ぴゅーっと落ちて、ぽよんと着地。葉っぱがひらひら */
const ki: Show = {
  id: 'deteku:ki',
  cat: 'deteku',
  name: 'きから ぽとん',
  icon: '🌳',
  hint: '3にち あそぶ',
  unlock: (u) => u.playDays >= 3,
  async play(ctx) {
    const pic = ctx.pic
    if (!pic) return
    if (ctx.motion <= 0) return fadeIn(ctx)
    const r = pic.getBoundingClientRect()
    const c = centerOf(r)
    const fall = Math.min(260, r.top + r.height * 0.4) // 落ちてくる高さ
    const hop = 14 + 26 * ctx.E // ぽよんと はねる高さ
    // 葉っぱ: 落ちるあいだと着地のとき
    drift('leaf', c.x, r.top - 10, Math.round(6 + 10 * ctx.E), r.width * 0.4)
    later(ctx, DETEKU_MS * 0.5, () => {
      ctx.sfx.bound()
      burst(c.x, r.bottom - 10, 'leaf', Math.round(4 + 8 * ctx.E), 0.5)
    })
    await move(
      ctx,
      track(30, (t) => {
        const o = clamp(t / 0.2)
        if (t < 0.5) return { y: -fall * (1 - (t / 0.5) ** 2), o }
        if (t < 0.6) return { y: 0, sy: 1 - 0.12 * sin(((t - 0.5) / 0.1) * PI), sx: 1 + 0.06 * sin(((t - 0.5) / 0.1) * PI), o: 1 }
        const u = (t - 0.6) / 0.4
        return { y: -hop * sin(u * PI), sy: 1 + 0.03 * sin(u * PI), o: 1 }
      }),
    )
  },
}

/** しゃぼんだまで飛んでくる: 絵が しゃぼんだまに入って 下からふわっと来て、パチンと割れる */
const shabon: Show = {
  id: 'deteku:shabon',
  cat: 'deteku',
  name: 'しゃぼんだま',
  icon: '🫧',
  hint: 'コースを 1かい クリア',
  unlock: (u) => u.clears >= 1,
  async play(ctx) {
    const pic = ctx.pic
    if (!pic) return
    if (ctx.motion <= 0) return fadeIn(ctx)
    const r = pic.getBoundingClientRect()
    const c = centerOf(r)
    const d = Math.min(r.width, r.height) * 1.08
    const rise = 150
    const bub = document.createElement('div')
    bub.className = 'deteku-bubble'
    Object.assign(bub.style, { width: `${d}px`, height: `${d}px` })
    ctx.layer.add(bub, { x: c.x, y: c.y })
    const pop = DETEKU_MS * 0.66
    void ctx.layer.go(
      bub,
      track(30, (t) => {
        if (t < 0.66) return { x: 14 * sin((t / 0.66) * 2 * PI), y: rise * (1 - ease(t / 0.66)), s: 0.92 + 0.08 * (t / 0.66), o: clamp(t / 0.2) }
        const u = (t - 0.66) / 0.34
        return { y: 0, s: 1 + 0.35 * u, o: 1 - u }
      }),
      { duration: DETEKU_MS, easing: 'linear' },
      true,
    )
    later(ctx, pop, () => {
      ctx.sfx.pon()
      burst(c.x, c.y, 'bubble', Math.round(10 + 22 * ctx.E), 0.9)
    })
    await move(
      ctx,
      track(30, (t) => {
        if (t < 0.66) return { x: 14 * sin((t / 0.66) * 2 * PI), y: rise * (1 - ease(t / 0.66)), s: 0.84 + 0.08 * (t / 0.66), o: clamp(t / 0.2) }
        const u = (t - 0.66) / 0.34
        return { y: 0, s: 0.92 + 0.12 * sin(u * PI) + 0.08 * u, o: 1 }
      }),
    )
  },
}

/** 土から出る: 下から もこもこっと 出てくる。土の粒が飛ぶ */
const tsuchi: Show = {
  id: 'deteku:tsuchi',
  cat: 'deteku',
  name: 'つちから もこもこ',
  icon: '🌱',
  hint: 'ことばを 10こ おぼえる',
  unlock: (u) => u.masteredTotal >= 10,
  async play(ctx) {
    const pic = ctx.pic
    if (!pic) return
    if (ctx.motion <= 0) return fadeIn(ctx)
    const r = pic.getBoundingClientRect()
    const c = centerOf(r)
    // 土の山（絵のいちばん下に ぽこっと盛り上がる）
    const mound = document.createElement('div')
    mound.className = 'deteku-mound'
    Object.assign(mound.style, { width: `${r.width * 0.7}px`, height: `${30 + 12 * ctx.E}px` })
    ctx.layer.add(mound, { x: c.x, y: r.bottom - 8 })
    void ctx.layer.go(mound, [{ opacity: 0, transform: 'scaleY(.2)' }, { opacity: 1, transform: 'scaleY(1)', offset: 0.25 }, { opacity: 1, transform: 'scaleY(1)', offset: 0.7 }, { opacity: 0, transform: 'scaleY(.5)' }], { duration: DETEKU_MS, easing: 'ease-out' }, true)
    // 土の粒
    const n = Math.round(3 + 6 * ctx.E)
    for (let i = 0; i < n; i++) later(ctx, 60 + i * 45, () => dust(ctx, c.x + (i % 2 ? 1 : -1) * (30 + Math.random() * r.width * 0.3), r.bottom - 20, 12 + Math.random() * 12))
    later(ctx, 120, () => ctx.sfx.rumble())
    const wob = 0.04 + 0.03 * ctx.E
    await move(
      ctx,
      track(32, (t) => {
        const u = ease(clamp(t / 0.8))
        // もこもこ: ふくらんだり ちぢんだりしながら 上がってくる
        const w = sin(t * 3 * PI * 2) * wob * (1 - u)
        return { y: 70 * (1 - u), sx: 1 + w, sy: 1 - w, o: clamp(t / 0.25) }
      }),
    )
  },
}

export const DETEKU_SHOWS: Show[] = [kurutto, present, ki, shabon, tsuchi]
