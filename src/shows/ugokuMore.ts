// うごくえの続き（13カテゴリ）。どれも ちがう動きにする。1秒に3回以上光らせない・痛い／こわい表現にしない
import { now } from '../lib/day'
import { burst, drift, rain, scatter, wind } from '../lib/effects'
import { PHRASES, instrumentOf, phraseLength } from '../lib/instruments'
import { seasonOf, weatherOf, wearsOnHead } from './kinds'
import type { Show, ShowCtx } from './types'
import { besideHost, bubbleText, centerOf, dust, ease, every, hostRect, monkeyOf, pop, say, spot, tint, track, withClone } from './util'

export const own = (cat: string) => (u: { masteredByCat: Record<string, number> }) => (u.masteredByCat[cat] ?? 0) >= 3
export const hint = (cat: string) => `${cat}の ことばを 3つ おぼえる`
const sin = Math.sin
const cos = Math.cos
const PI = Math.PI
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** total ミリ秒のあいだ、step ミリ秒ごとに f を呼ぶ（片づけにも登録する） */
function pour(ctx: ShowCtx, step: number, total: number, f: () => void): () => void {
  const t0 = performance.now()
  const stop = every(ctx, step, () => (performance.now() - t0 > total ? stop() : f()))
  return stop
}

/** ことばの絵のうしろに ふわっと出す、やわらかい光の丸 */
function glowDisc(ctx: ShowCtx, x: number, y: number, size: number, color: string, ms: number, peak = 0.9) {
  const el = document.createElement('div')
  el.className = 'show-halo'
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, background: `radial-gradient(circle, ${color} 0%, ${color} 28%, transparent 68%)` })
  ctx.layer.add(el, { x, y })
  void ctx.layer.go(el, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: peak, transform: 'scale(1)', offset: 0.35 }, { opacity: peak, transform: 'scale(1.1)', offset: 0.7 }, { opacity: 0, transform: 'scale(1.25)' }], { duration: ms, easing: 'ease-in-out' }, true)
}

/** はな・しょくぶつ: 小さなつぼみから ふわっと咲いて、花びらが舞う */
export const hana: Show = {
  id: 'ugoku:hana',
  cat: 'ugoku',
  name: 'ふわっと さく',
  icon: '🌷',
  forCat: 'はな・しょくぶつ',
  hint: hint('はな・しょくぶつ'),
  unlock: own('はな・しょくぶつ'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const T = 1600
      const t0 = performance.now()
      ctx.sfx.bloom()
      const bloomAt = setTimeout(() => burst(me.x, me.y, 'petal', 16, 0.9), T * 0.4)
      ctx.layer.defer(() => clearTimeout(bloomAt))
      const stop = every(ctx, 240, () => {
        if (performance.now() - t0 > T * 0.45) drift('petal', me.x, me.y - 20, 2, 70)
      })
      await ctx.layer.go(
        c,
        track(48, (t) => {
          const k = ease(clamp01(t / 0.55)) // 咲く
          const over = 1 + 0.12 * sin(clamp01((t - 0.5) / 0.3) * PI) // 咲いたあと ふわっとふくらむ
          const settle = t > 0.6 ? sin((t - 0.6) * 8 * PI) * 4 * (1 - t) * 2.5 : 0
          return { s: (0.14 + 0.86 * k) * over, r: -35 * (1 - k) + settle, y: 34 * (1 - k), o: 0.55 + 0.45 * clamp01(t / 0.2), f: `brightness(${1 + 0.12 * sin(clamp01(t) * PI)})` }
        }),
        { duration: T, easing: 'linear' },
      )
      stop()
    })
  },
}

/** しぜん・てんき: 単語の天気が画面に出る（あめ・ゆき・にじ・たいよう・かみなり・かぜ。ほかは きらきら） */
export const tenki: Show = {
  id: 'ugoku:tenki',
  cat: 'ugoku',
  name: 'おてんき',
  icon: '🌈',
  forCat: 'しぜん・てんき',
  hint: hint('しぜん・てんき'),
  unlock: own('しぜん・てんき'),
  async play(ctx) {
    pop(ctx)
    const w = weatherOf(ctx.q)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const T = 2000
      const sway = (amp: number) => track(40, (t) => ({ s: 1 + 0.07 * sin(t * PI), r: sin(t * 4 * PI) * amp * sin(t * PI) }))
      if (w === 'rain') {
        ctx.sfx.rain()
        tint(ctx, 'rgba(80, 110, 165, 0.24)', T)
        pour(ctx, 80, T * 0.8, () => rain('raindrop', 7))
        await ctx.layer.go(c, sway(4), { duration: T, easing: 'linear' })
      } else if (w === 'snow') {
        ctx.sfx.sparkle()
        tint(ctx, 'rgba(215, 232, 255, 0.28)', T)
        pour(ctx, 110, T * 0.85, () => scatter('snow', 6, -0.05, 0.7))
        await ctx.layer.go(c, sway(5), { duration: T, easing: 'linear' })
      } else if (w === 'rainbow') {
        ctx.sfx.bloom()
        // にじの弧（CSS）。左から右へ ふわっと現れる
        const W = Math.min(innerWidth - 20, from.width * 0.95, from.height * 1.8, 400) // 絵のカードの中におさまる大きさ
        const R = W / 2
        const colors = ['#da77f2', '#748ffc', '#4dabf7', '#69db7c', '#ffe066', '#ffa94d', '#ff6b6b'] // うちがわ → そとがわ
        const band = 10
        const inner = R - band * colors.length
        const stops = colors.map((col, i) => `${col} ${inner + i * band}px ${inner + (i + 1) * band}px`).join(', ')
        const arc = document.createElement('div')
        arc.className = 'show-rainbow'
        Object.assign(arc.style, { width: `${W}px`, height: `${R}px`, background: `radial-gradient(circle ${R}px at 50% 100%, transparent 0 ${inner}px, ${stops}, transparent ${R}px)` })
        ctx.layer.add(arc, { x: me.x, y: me.y + from.height * 0.1 - R / 2 })
        void ctx.layer.go(arc, [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 0.92, clipPath: 'inset(0 0% 0 0)', offset: 0.4 }, { opacity: 0.92, clipPath: 'inset(0 0% 0 0)', offset: 0.8 }, { opacity: 0, clipPath: 'inset(0 0% 0 0)' }], { duration: T, easing: 'ease-in-out' }, true)
        await ctx.layer.go(c, sway(3), { duration: T, easing: 'linear' })
      } else if (w === 'sun') {
        ctx.sfx.bloom()
        glowDisc(ctx, me.x, me.y, Math.min(from.width, 300) * 1.1, 'rgba(255, 236, 140, 0.95)', T)
        // 光の輪が ゆっくり広がる（2回だけ）
        for (const delay of [0, 800]) {
          const ring = document.createElement('div')
          ring.className = 'show-ring'
          ctx.layer.add(ring, { x: me.x, y: me.y })
          void ctx.layer.go(ring, [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 0.85, transform: 'scale(1.1)', offset: 0.3 }, { opacity: 0, transform: 'scale(2.6)' }], { duration: 1200, delay, easing: 'ease-out', fill: 'backwards' }, true)
        }
        await ctx.layer.go(c, track(40, (t) => ({ s: 1 + 0.08 * sin(t * PI), r: sin(t * 2 * PI) * 5, f: `brightness(${1 + 0.18 * sin(t * PI)})` })), { duration: T, easing: 'linear' })
      } else if (w === 'thunder') {
        // ゴロゴロ…小さく。光はやさしく1回だけ（ゆっくり出て、ゆっくり消える）
        tint(ctx, 'rgba(60, 60, 95, 0.28)', T)
        setTimeout(() => ctx.sfx.rumble(), 250)
        glowDisc(ctx, me.x, me.y, Math.min(from.width, 300) * 1.2, 'rgba(255, 244, 170, 0.8)', 1100, 0.45)
        const bolt = ctx.layer.emoji('⚡', me.x, from.top + 30, 44)
        void ctx.layer.go(bolt, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 1, transform: 'scale(1)', offset: 0.7 }, { opacity: 0, transform: 'scale(1)' }], { duration: 1200 }, true)
        await ctx.layer.go(c, track(48, (t) => ({ x: sin(t * 14 * PI) * 3 * sin(t * PI), s: 1 + 0.04 * sin(t * PI) })), { duration: T, easing: 'linear' })
      } else if (w === 'wind') {
        ctx.sfx.wind()
        pour(ctx, 90, T * 0.6, () => wind('leaf', 3))
        await ctx.layer.go(c, track(40, (t) => ({ x: sin(t * 3 * PI) * 12 * sin(t * PI), r: 10 * sin(t * 3 * PI) * sin(t * PI), s: 1 })), { duration: T, easing: 'linear' })
      } else {
        // どれにも当たらない: きらきら
        ctx.sfx.bloom()
        burst(me.x, me.y, 'star', 24, 1.1)
        await ctx.layer.go(c, track(40, (t) => ({ r: 360 * ease(clamp01(t / 0.7)), s: 1 + 0.1 * sin(t * PI), f: `brightness(${1 + 0.35 * sin(t * PI)})` })), { duration: 1400, easing: 'linear' })
      }
    })
  },
}

/** がっき・おと: 単語の楽器の音が鳴って、音符が出る（たいこ ドンドン / ぴあの ドレミ / らっぱ パパーン / すず シャンシャン / ほかは木琴） */
export const gakki: Show = {
  id: 'ugoku:gakki',
  cat: 'ugoku',
  name: 'ならそう',
  icon: '🎵',
  forCat: 'がっき・おと',
  hint: hint('がっき・おと'),
  unlock: own('がっき・おと'),
  async play(ctx) {
    pop(ctx)
    const kind = instrumentOf(ctx.q)
    const notes = PHRASES[kind]
    // 近すぎる音（0.25秒より短い間）は、絵のはずみを1回にまとめる（ぶるぶる動かさない）
    const hits: typeof notes = []
    for (const p of notes) if (hits.length === 0 || p.t - hits[hits.length - 1].t >= 0.25) hits.push(p)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const T = phraseLength(kind) * 1000 + 450
      ctx.sfx.instrument(kind)
      for (const [i, p] of notes.entries()) {
        const id = setTimeout(() => drift('note', me.x + (i % 2 ? 40 : -40), me.y - from.height * 0.25, 1, 30), p.t * 1000)
        ctx.layer.defer(() => clearTimeout(id))
      }
      await ctx.layer.go(
        c,
        track(60, (t) => {
          const ms = t * T
          let pulse = 0
          let k = 0
          hits.forEach((p, i) => {
            const d = ms - p.t * 1000
            if (d >= 0 && d < 260) {
              pulse = Math.max(pulse, sin((d / 260) * PI))
              k = i
            }
          })
          return { s: 1 + 0.1 * pulse, sy: 1 - 0.04 * pulse + 0.1 * pulse, r: pulse * (k % 2 ? -5 : 5), y: -10 * pulse }
        }),
        { duration: T, easing: 'linear' },
      )
    })
  },
}

/** おもちゃ・あそび: ぼよーん、ぼよーん、と跳ねて、ころころ転がって もどる */
export const omocha: Show = {
  id: 'ugoku:omocha',
  cat: 'ugoku',
  name: 'ぼよーん',
  icon: '🧸',
  forCat: 'おもちゃ・あそび',
  hint: hint('おもちゃ・あそび'),
  unlock: own('おもちゃ・あそび'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const hop = Math.max(24, Math.min(90, from.top - 80))
      const T = 2000
      const A = 0.6 // 跳ねる間
      for (const k of [1, 2, 3]) {
        const id = setTimeout(() => ctx.sfx.bound(), ((k / 3) * A * T) | 0)
        ctx.layer.defer(() => clearTimeout(id))
      }
      c.style.transformOrigin = '50% 90%'
      await ctx.layer.go(
        c,
        track(60, (t) => {
          if (t < A) {
            const u = (t / A) * 3
            const n = Math.min(2, Math.floor(u))
            const v = u - n
            const h = [1, 0.6, 0.3][n]
            const land = v < 0.07 || v > 0.93
            return { y: -hop * h * 4 * v * (1 - v), sx: land ? 1.16 : 1 - 0.04 * sin(v * PI), sy: land ? 0.84 : 1 + 0.06 * sin(v * PI), r: sin(v * PI * 2) * 4 }
          }
          const w = (t - A) / (1 - A)
          const x = 70 * sin(w * 2 * PI) // ころころ 右へ → 左へ
          return { x, r: x * 1.6 }
        }),
        { duration: T, easing: 'linear' },
      )
    })
  },
}

/** すぽーつ: ボールのように大きな弧を描いて、はずみながら右へ飛んでいく */
export const sports: Show = {
  id: 'ugoku:sports',
  cat: 'ugoku',
  name: 'ぽーんと とぶ',
  icon: '⚽',
  forCat: 'すぽーつ',
  hint: hint('すぽーつ'),
  unlock: own('すぽーつ'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const dx = innerWidth - from.left + 30
      const base = Math.max(40, Math.min(150, from.top - 60))
      const H = [base, base * 0.6, base * 0.3]
      const T = 1800
      ctx.sfx.whoosh()
      for (const k of [1, 2]) {
        const id = setTimeout(() => ctx.sfx.bound(), ((k / 3) * T) | 0)
        ctx.layer.defer(() => clearTimeout(id))
      }
      await ctx.layer.go(
        c,
        track(60, (t) => {
          const u = t * 3
          const n = Math.min(2, Math.floor(u))
          const v = u - n
          return { x: dx * t, y: -H[n] * 4 * v * (1 - v), r: 540 * t, sx: v < 0.05 || v > 0.95 ? 1.1 : 1, sy: v < 0.05 || v > 0.95 ? 0.9 : 1 }
        }),
        { duration: T, easing: 'linear' },
        true,
      )
    })
  },
}

/** まち・たてもの: 一度 地面に沈んで、ずずーんと生えてくる。土けむりが出る */
export const machi: Show = {
  id: 'ugoku:machi',
  cat: 'ugoku',
  name: 'ずずーん',
  icon: '🏢',
  forCat: 'まち・たてもの',
  hint: hint('まち・たてもの'),
  unlock: own('まち・たてもの'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const T = 2300
      c.style.transformOrigin = '50% 100%'
      // 地面
      const ground = document.createElement('div')
      ground.className = 'show-ground'
      Object.assign(ground.style, { width: `${from.width * 0.8}px` })
      ctx.layer.add(ground, { x: me.x, y: from.top + from.height - 4 })
      void ctx.layer.go(ground, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: T }, true)
      const rumble = setTimeout(() => ctx.sfx.rumble(), T * 0.4)
      const text = setTimeout(() => void bubbleText(ctx, 'ずずーん', me.x, from.top + from.height * 0.45, 800), T * 0.55)
      ctx.layer.defer(() => {
        clearTimeout(rumble)
        clearTimeout(text)
      })
      pour(ctx, 150, T * 0.78, () => dust(ctx, from.left + from.width * (0.15 + ctx.rng() * 0.7), from.top + from.height - 12, 24 + ctx.rng() * 22))
      await ctx.layer.go(
        c,
        track(60, (t) => {
          if (t < 0.16) return { sy: Math.max(0.02, 1 - ease(t / 0.16)) } // 沈む
          if (t < 0.4) return { sy: 0.02, x: sin(t * 50) * 2 }
          const w = clamp01((t - 0.4) / 0.4) // 生えてくる
          const sy = 0.02 + 0.98 * ease(w)
          const over = 1 + 0.07 * sin(clamp01((w - 0.7) / 0.3) * PI)
          return { sy: sy * over, sx: 1 + (t < 0.8 ? 0.02 * sin(t * 90) : 0), x: t < 0.8 ? sin(t * 70) * 3 : 0 }
        }),
        { duration: T, easing: 'linear' },
      )
    })
  },
}

/** ふく・みにつけるもの: 小さくなって、おさるに重なり（頭のものは頭に）「にあう？」。くるっと回って消える（そのときだけ） */
export const fuku: Show = {
  id: 'ugoku:fuku',
  cat: 'ugoku',
  name: 'きてみる',
  icon: '👕',
  forCat: 'ふく・みにつけるもの',
  hint: hint('ふく・みにつけるもの'),
  unlock: own('ふく・みにつけるもの'),
  async play(ctx) {
    pop(ctx)
    const onHead = wearsOnHead(ctx.q)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const h = hostRect(ctx)
      const tx = h.left + h.width / 2
      const ty = onHead ? h.top + h.height * 0.1 : h.top + h.height * 0.62
      const dx = tx - me.x
      const dy = ty - me.y
      const size = onHead ? 46 : 60
      const S = size / Math.min(from.width, from.height)
      const T = 2600
      const monkey = monkeyOf(ctx)
      const at = besideHost(ctx, 70)
      const t1 = setTimeout(() => void say(ctx, 'にあう？', at.x, at.y, 1100), T * 0.4)
      const t2 = setTimeout(() => {
        ctx.sfx.sparkle()
        burst(tx, ty, 'star', 10, 0.8)
      }, T * 0.82)
      ctx.layer.defer(() => {
        clearTimeout(t1)
        clearTimeout(t2)
      })
      if (monkey) setTimeout(() => void ctx.layer.go(monkey, track(10, (t) => ({ y: -8 * sin(t * PI), sy: 1 + 0.05 * sin(t * PI) })), { duration: 500 }), T * 0.42)
      await ctx.layer.go(
        c,
        track(70, (t) => {
          if (t < 0.34) {
            const k = ease(t / 0.34) // とんでいって 小さくなる
            return { x: dx * k, y: dy * k - 50 * sin(k * PI), s: 1 - (1 - S) * k, r: 360 * k }
          }
          if (t < 0.7) return { x: dx, y: dy, s: S, r: sin((t - 0.34) * 22) * 5 } // きて ゆれる
          const w = (t - 0.7) / 0.3 // くるっと回って消える
          return { x: dx, y: dy, s: S * (1 - ease(w)), r: 720 * ease(w), o: 1 - w * w }
        }),
        { duration: T, easing: 'linear' },
        true,
      )
    })
  },
}

/** かたち: ぷにっとつぶれて、びよーんと戻る */
export const katachi: Show = {
  id: 'ugoku:katachi',
  cat: 'ugoku',
  name: 'ぷにっ',
  icon: '🔷',
  forCat: 'かたち',
  hint: hint('かたち'),
  unlock: own('かたち'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const T = 1700
      c.style.transformOrigin = '50% 100%'
      const sp = setTimeout(() => {
        ctx.sfx.boing()
        burst(me.x, me.y, 'star', 8, 0.8)
      }, T * 0.28)
      ctx.layer.defer(() => clearTimeout(sp))
      await ctx.layer.go(
        c,
        track(70, (t) => {
          if (t < 0.22) {
            const k = ease(t / 0.22) // ぷにっ
            return { sy: 1 - 0.42 * k, sx: 1 + 0.3 * k }
          }
          if (t < 0.28) return { sy: 0.58, sx: 1.3, x: sin(t * 120) * 1.5 }
          const u = (t - 0.28) / 0.72 // びよーん
          const fade = 1 - clamp01((u - 0.85) / 0.15)
          const sy = 1 + (0.58 - 1) * Math.exp(-4.2 * u) * cos(u * 2 * PI * 2.2) * fade
          const amp = Math.min(1.22, Math.max(0.6, sy))
          return { sy: amp, sx: 1 + (1 - amp) * 0.7 }
        }),
        { duration: T, easing: 'linear' },
      )
    })
  },
}

/** いえのもの: 白い光の帯が すーっと通って、ぴかぴかになる */
export const ie: Show = {
  id: 'ugoku:ie',
  cat: 'ugoku',
  name: 'ぴかぴか',
  icon: '🧹',
  forCat: 'いえのもの',
  hint: hint('いえのもの'),
  unlock: own('いえのもの'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const T = 1900
      const pr = ctx.pic?.getBoundingClientRect() ?? from
      const box = document.createElement('div')
      box.className = 'show-sweep'
      ctx.layer.add(box)
      Object.assign(box.style, { left: `${pr.left}px`, top: `${pr.top}px`, width: `${pr.width}px`, height: `${pr.height}px` })
      const band = document.createElement('div')
      band.className = 'sweep-band'
      box.appendChild(band)
      void ctx.layer.go(band, [{ transform: 'translateX(-140%) skewX(-18deg)' }, { transform: 'translateX(330%) skewX(-18deg)' }], { duration: 1100, delay: 200, easing: 'ease-in-out', fill: 'both' })
      // つやつやの ✨ が ぽんぽんと出る
      for (let i = 0; i < 6; i++) {
        const x = from.left + from.width * (0.18 + ctx.rng() * 0.64)
        const y = from.top + from.height * (0.18 + ctx.rng() * 0.64)
        const sp = ctx.layer.emoji('✨', x, y, 30)
        sp.style.opacity = '0'
        void ctx.layer.go(sp, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.2)', offset: 0.4 }, { opacity: 0, transform: 'scale(.3) rotate(90deg)' }], { duration: 600, delay: 350 + i * 190, fill: 'backwards' }, true)
      }
      const chime = setTimeout(() => ctx.sfx.bloom(), 500)
      ctx.layer.defer(() => clearTimeout(chime))
      await ctx.layer.go(c, track(48, (t) => ({ s: 1 + 0.04 * sin(t * PI), f: `brightness(${1 + 0.22 * sin(clamp01((t - 0.15) / 0.7) * PI)})` })), { duration: T, easing: 'linear' })
      box.remove()
    })
  },
}

/** どうぐ: トンカン、と2回たたく。星が出る */
export const dougu: Show = {
  id: 'ugoku:dougu',
  cat: 'ugoku',
  name: 'とんかん',
  icon: '🔨',
  forCat: 'どうぐ',
  hint: hint('どうぐ'),
  unlock: own('どうぐ'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const T = 1700
      const hits = [0.28, 0.58]
      const hx = me.x + from.width * 0.22
      const hy = me.y - from.height * 0.32
      const hammer = ctx.layer.emoji('🔨', hx, hy, 64)
      hammer.style.transformOrigin = '88% 88%'
      hits.forEach((h, i) => {
        const id = setTimeout(() => {
          ctx.sfx.tonkan(i)
          burst(me.x + (i ? 24 : -24), me.y - 10, 'star', 9, 0.9)
          void bubbleText(ctx, i ? 'カン！' : 'トン！', me.x + (i ? 70 : -70), from.top + 26, 600)
        }, h * T)
        ctx.layer.defer(() => clearTimeout(id))
      })
      c.style.transformOrigin = '50% 100%'
      const swing = (t: number) => {
        // ふりあげる（ゆっくり）→ たたく（はやい）→ もどす
        let a = 32
        for (const h of hits) {
          const d = t - h
          if (d > -0.14 && d <= 0) a = Math.min(a, 32 - 70 * ease((d + 0.14) / 0.14))
          else if (d > 0 && d < 0.1) a = Math.min(a, -38 + 70 * ease(d / 0.1))
        }
        return a
      }
      const swingKf = track(68, (t) => ({ r: swing(t), o: t > 0.92 ? (1 - t) / 0.08 : 1 }))
      void ctx.layer.go(hammer, swingKf.map((k) => ({ ...k, transformOrigin: '88% 88%' })), { duration: T, easing: 'linear' }, true)
      await ctx.layer.go(
        c,
        track(68, (t) => {
          let sq = 0
          for (const h of hits) {
            const d = t - h
            if (d >= 0 && d < 0.12) sq = Math.max(sq, sin((d / 0.12) * PI))
          }
          return { sy: 1 - 0.12 * sq, sx: 1 + 0.08 * sq }
        }),
        { duration: T, easing: 'linear' },
      )
    })
  },
}

/** からだ: 司会のおさるが となりに来て、同じポーズをまねっこ。いっしょに ぴょんと跳ねる */
export const karada: Show = {
  id: 'ugoku:karada',
  cat: 'ugoku',
  name: 'まねっこ',
  icon: '🙆',
  forCat: 'からだ',
  hint: hint('からだ'),
  unlock: own('からだ'),
  async play(ctx) {
    pop(ctx)
    const monkey = monkeyOf(ctx) as HTMLElement | null
    await withClone(ctx, async (c, from) => {
      if (!monkey) return
      const m = monkey.getBoundingClientRect()
      const mc = ctx.layer.cloneOf(monkey)
      monkey.style.opacity = '0'
      ctx.layer.defer(() => (monkey.style.opacity = ''))
      const me = centerOf(from)
      // おさるは 絵のとなり（左）、絵は少し小さくして右へ
      const tx = from.left + from.width * 0.2
      const ty = from.top + from.height * 0.66
      const mx = tx - (m.left + m.width / 2)
      const my = ty - (m.top + m.height / 2)
      const zoom = Math.min(2, from.width / m.width / 3.2)
      const shift = from.width * 0.12
      const T = 2800
      const pose = (t: number) => {
        // 0.18〜0.42: 左にかたむく / 0.42〜0.66: 右にかたむく / 0.7〜0.95: いっしょに ぴょん
        if (t < 0.18) return { r: 0, y: 0, hop: 0 }
        if (t < 0.42) return { r: -14 * sin(((t - 0.18) / 0.24) * PI), y: 0, hop: 0 }
        if (t < 0.66) return { r: 14 * sin(((t - 0.42) / 0.24) * PI), y: 0, hop: 0 }
        if (t < 0.7) return { r: 0, y: 0, hop: 0 }
        if (t < 0.95) {
          const u = (t - 0.7) / 0.25
          return { r: 0, y: -50 * 4 * u * (1 - u), hop: u < 0.08 || u > 0.92 ? 1 : 0 }
        }
        return { r: 0, y: 0, hop: 0 }
      }
      const landing = setTimeout(() => ctx.sfx.bound(), 0.88 * T)
      ctx.layer.defer(() => clearTimeout(landing))
      const inOut = (t: number) => (t < 0.16 ? ease(t / 0.16) : t > 0.92 ? 1 - ease((t - 0.92) / 0.08) : 1)
      mc.style.transformOrigin = '50% 100%'
      c.style.transformOrigin = '50% 100%'
      await Promise.all([
        ctx.layer.go(
          mc,
          track(80, (t) => {
            const k = inOut(t)
            const p = pose(t)
            return { x: mx * k, y: my * k + p.y, s: 1 + (zoom - 1) * k, r: p.r, sy: p.hop ? 0.88 : undefined }
          }),
          { duration: T, easing: 'linear' },
          true,
        ),
        ctx.layer.go(
          c,
          track(80, (t) => {
            const k = inOut(t)
            const p = pose(t)
            return { x: shift * k, s: 1 - 0.18 * k, y: p.y, r: p.r, sy: p.hop ? 0.9 : undefined }
          }),
          { duration: T, easing: 'linear' },
        ),
      ])
      burst(me.x, me.y, 'star', 6, 0.7)
    })
  },
}

/** ひと・おしごと: 手をふるように左右にゆれて、ぺこっとおじぎ。「ありがとう！」 */
export const hito: Show = {
  id: 'ugoku:hito',
  cat: 'ugoku',
  name: 'ありがとう',
  icon: '🙇',
  forCat: 'ひと・おしごと',
  hint: hint('ひと・おしごと'),
  unlock: own('ひと・おしごと'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c) => {
      const T = 2300
      const at = besideHost(ctx, 80)
      const tt = setTimeout(() => void say(ctx, 'ありがとう！', at.x, at.y, 1100), T * 0.6)
      ctx.layer.defer(() => clearTimeout(tt))
      c.style.transformOrigin = '50% 100%'
      const kf: Keyframe[] = Array.from({ length: 61 }, (_, i) => {
        const t = i / 60
        const wave = t < 0.55 ? 13 * sin((t / 0.55) * 3 * 2 * PI) * (1 - 0.3 * (t / 0.55)) : 0 // 手をふる
        const bow = t >= 0.6 && t < 0.92 ? 34 * sin(((t - 0.6) / 0.32) * PI) : 0 // ぺこっ
        return { offset: t, transform: `perspective(520px) rotate(${wave}deg) rotateX(${bow}deg)` }
      })
      await ctx.layer.go(c, kf, { duration: T, easing: 'linear' })
      burst(spot(ctx).x, spot(ctx).y, 'star', 8, 0.7)
    })
  },
}

/** きせつ・ぎょうじ: その月の季節の粒（はる=花びら・なつ=泡・あき=葉っぱ・ふゆ=雪）が降る */
export const kisetsu: Show = {
  id: 'ugoku:kisetsu',
  cat: 'ugoku',
  name: 'きせつの つぶ',
  icon: '🍂',
  forCat: 'きせつ・ぎょうじ',
  hint: hint('きせつ・ぎょうじ'),
  unlock: own('きせつ・ぎょうじ'),
  async play(ctx) {
    pop(ctx)
    const { kind } = seasonOf(new Date(now()).getMonth() + 1)
    await withClone(ctx, async (c) => {
      const T = 2100
      ctx.sfx.sparkle()
      pour(ctx, 110, T * 0.85, () => (kind === 'bubble' ? scatter(kind, 5, 0.55, 1) : scatter(kind, 6, -0.05, 0.6)))
      await ctx.layer.go(c, track(48, (t) => ({ s: 1 + 0.06 * sin(t * PI), r: sin(t * 4 * PI) * 5 * sin(t * PI), y: -6 * sin(t * 2 * PI) })), { duration: T, easing: 'linear' })
    })
  },
}
