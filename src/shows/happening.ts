// ハプニング: 遊んでいるあいだに たまに起きる、ただ楽しいだけの出来事（10種）。
// 得点や問題には関係しない。pointer-events なし・3秒以内・こわい見た目にしない。
// 出るのは 問題の読み上げ中。「みつけた！」のバッジ・記録は Quiz と progress.ts がやる（ここは見た目だけ）
// どれも .hap-arena（クイズ画面全体。ずかんの「ためす」のときは舞台だけ）の中に置くので、舞台の外にはみ出さない
import type { Show, ShowCtx } from './types'
import { ease, track, wait } from './util'

/** ハプニングの長さの上限（ms）。3秒以内 */
export const HAP_MAX = 3000

const sin = Math.sin
const PI = Math.PI
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

type Arena = {
  el: HTMLElement
  w: number
  h: number
  /** 大きさの倍率（クイズ画面で 1。舞台は小さいので ちいさく） */
  k: number
  /** 問題の絵のカード（arena の中の座標）。なければ null */
  pic: DOMRect | null
}

function arena(ctx: ShowCtx): Arena {
  const stage = ctx.preview ? (ctx.pic?.closest('.pv-stage') as HTMLElement | null) : null
  const r = stage ? stage.getBoundingClientRect() : new DOMRect(0, 0, innerWidth, innerHeight)
  const el = document.createElement('div')
  el.className = 'hap-arena'
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
  ctx.layer.add(el)
  const p = ctx.pic?.getBoundingClientRect()
  return { el, w: r.width, h: r.height, k: Math.min(1, Math.min(r.width, r.height * 0.62) / 390), pic: p ? new DOMRect(p.left - r.left, p.top - r.top, p.width, p.height) : null }
}

/** arena に絵文字を置く（(x,y) が中心） */
function emo(A: Arena, ch: string, x: number, y: number, size: number, cls = ''): HTMLElement {
  const el = document.createElement('div')
  el.className = `hap-emoji ${cls}`
  Object.assign(el.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.85}px`, lineHeight: `${size}px` })
  el.textContent = ch
  A.el.appendChild(el)
  return el
}

/** arena に div を置く（(x,y) が中心） */
function box(A: Arena, cls: string, x: number, y: number, w: number, h: number, html = ''): HTMLElement {
  const el = document.createElement('div')
  el.className = cls
  Object.assign(el.style, { left: `${x - w / 2}px`, top: `${y - h / 2}px`, width: `${w}px`, height: `${h}px` })
  el.innerHTML = html
  A.el.appendChild(el)
  return el
}

const go = (ctx: ShowCtx, el: Element, kf: Keyframe[], ms: number, delay = 0) => ctx.layer.go(el, kf, { duration: ms, delay, easing: 'linear', fill: 'both' })

function later(ctx: ShowCtx, ms: number, f: () => void) {
  const t = setTimeout(f, ms)
  ctx.layer.defer(() => clearTimeout(t))
}

/** ハプニング1つ。動きの強さ 0 のときは アイコンが ふわっと出て消えるだけ */
function hap(id: string, name: string, icon: string, body: (ctx: ShowCtx, A: Arena) => Promise<void>): Show {
  return {
    id: `hap:${id}`,
    cat: 'happening',
    name,
    icon,
    maxMs: HAP_MAX,
    async play(ctx) {
      const A = arena(ctx)
      try {
        if (ctx.motion <= 0) {
          emo(A, icon, A.w / 2, A.h * 0.45, 120 * Math.max(0.5, A.k))
          // 動きの強さ 0: その場で ふわっと出て、ふわっと消えるだけ
          await A.el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1400, easing: 'ease-in-out' }).finished.catch(() => {})
          return
        }
        await Promise.race([body(ctx, A), wait(HAP_MAX)])
      } finally {
        A.el.remove()
      }
    },
  }
}

/** UFO: 絵を ひゅーっと吸い上げて、すぐに返してくれる */
const ufo = hap('ufo', 'ゆーふぉーが きた', '🛸', async (ctx, A) => {
  const k = A.k
  const pic = A.pic ?? new DOMRect(A.w * 0.05, A.h * 0.3, A.w * 0.9, A.h * 0.4)
  const cx = pic.left + pic.width / 2
  const topY = Math.max(40 * k, pic.top - 10 * k)
  const beamH = Math.max(40, pic.top + pic.height * 0.45 - topY)
  const beam = box(A, 'hap-beam', cx, topY + beamH / 2 + 24 * k, 150 * k, beamH)
  beam.style.opacity = '0'
  const saucer = emo(A, '🛸', 0, topY, 96 * k, 'hap-ufo')
  ctx.sfx.ufo()
  // 右の上から ゆらゆら来て、絵の上でとまる → ビーム → 絵が上がる → すぐ戻る → 帰っていく
  const sx = A.w + 60 * k
  const inT = 0.26
  void go(
    ctx,
    saucer,
    track(30, (t) => {
      const wob = 5 * k * sin(t * 12 * PI)
      if (t < inT) return { x: cx + (sx - cx) * (1 - ease(t / inT)), y: wob - 30 * k * (1 - ease(t / inT)) }
      if (t < 0.8) return { x: cx, y: wob }
      const u = ease((t - 0.8) / 0.2)
      return { x: cx + (sx - cx) * u, y: wob - 30 * k * u, o: 1 - u * 0.6 }
    }),
    2900,
  )
  void go(ctx, beam, [{ opacity: 0 }, { opacity: 0, offset: 0.27 }, { opacity: 0.85, offset: 0.34 }, { opacity: 0.85, offset: 0.7 }, { opacity: 0, offset: 0.78 }, { opacity: 0 }], 2900)
  // 絵: 吸い上げられて小さくなり、ゆらゆらして、ぽんっと戻る（絵のカードそのものを動かす。なければ何もしない）
  if (ctx.pic) {
    later(ctx, 0.34 * 2900, () => ctx.sfx.boing())
    await ctx.layer.go(
      ctx.pic,
      track(40, (t) => {
        if (t < 0.34) return {}
        if (t < 0.5) {
          const u = ease((t - 0.34) / 0.16)
          return { y: -pic.height * 0.18 * u, s: 1 - 0.45 * u, r: 4 * sin(u * 3 * PI) }
        }
        if (t < 0.6) return { y: -pic.height * 0.18, s: 0.55, r: 5 * sin((t - 0.5) * 30) }
        const u = clamp((t - 0.6) / 0.16)
        const back = ease(u)
        return { y: -pic.height * 0.18 * (1 - back), s: 0.55 + 0.45 * back + 0.06 * sin(u * PI), r: 0 }
      }),
      { duration: 2900, easing: 'linear' },
    )
  } else await wait(2900)
})

/** きりん: 大きなきりんが、画面の横から首を出して のぞく */
const kirin = hap('kirin', 'おおきな きりん', '🦒', async (ctx, A) => {
  const k = A.k
  const size = 250 * k
  const y = A.pic ? A.pic.top + A.pic.height * 0.4 : A.h * 0.45
  const g = emo(A, '🦒', A.w - size * 0.2, y, size, 'hap-kirin')
  ctx.sfx.boing()
  const T = 2800
  await go(
    ctx,
    g,
    track(40, (t) => {
      const inn = ease(clamp(t / 0.22))
      const out = ease(clamp((t - 0.82) / 0.18))
      const look = 5 * sin(t * 4 * PI) * (t > 0.25 && t < 0.8 ? 1 : 0) // きょろきょろ
      return { x: size * 0.85 * (1 - inn + out), r: -8 + look, y: 3 * k * sin(t * 6 * PI) }
    }),
    T,
  )
})

/** きしゃ: 画面の下を ポッポーと横切る */
const kisha = hap('kisha', 'きしゃが とおる', '🚂', async (ctx, A) => {
  const k = A.k
  const s = 72 * k
  const y = A.h - s * 0.62 - 4
  const rail = box(A, 'hap-rail', A.w / 2, y + s * 0.5, A.w, 5)
  rail.style.opacity = '0.6'
  const cars = ['🚂', '🚃', '🚃', '🚃']
  const T = 2600
  const total = cars.length * s * 0.98
  ctx.sfx.poppo()
  later(ctx, 1300, () => ctx.sfx.poppo())
  cars.forEach((c, i) => {
    const el = emo(A, c, 0, y, s, 'hap-train')
    void go(ctx, el, track(26, (t) => ({ x: lerp(A.w + s * 0.6 + i * s * 0.98, -total - s, t) , y: -2 * k * Math.abs(sin(t * 22 * PI)) })), T)
  })
  // けむり: けむりを出しながら 走る（ずっと 左にむかう きしゃの 少しうしろ）
  for (let i = 0; i < 5; i++) {
    later(ctx, 150 + i * 430, () => {
      const t = (150 + i * 430) / T
      const x = lerp(A.w + s * 0.6, -total - s, t) - s * 0.15
      const p = box(A, 'show-puff', x, y - s * 0.55, 20 * k, 20 * k)
      void go(ctx, p, [{ opacity: 0.9, transform: 'translate(0,0) scale(.5)' }, { opacity: 0, transform: `translate(${-16 * k}px, ${-34 * k}px) scale(1.8)` }], 800)
    })
  }
  await wait(T + 100)
})

/** にじ: 大きな虹が、ふわっとかかる */
const niji = hap('niji', 'おおきな にじ', '🌈', async (ctx, A) => {
  const k = A.k
  const w = A.w * 0.94
  const h = w * 0.55
  const cx = A.w / 2
  const y = A.pic ? Math.max(h * 0.5, A.pic.top + A.pic.height * 0.2) : A.h * 0.3
  const colors = ['#ff5a5a', '#ff9a3c', '#ffd83a', '#5fd36a', '#4ab8ff', '#6a6aff', '#b36aff']
  const arcs = colors.map((c, i) => `<path d="M ${4 + i * 6} 100 A ${96 - i * 6} ${96 - i * 6} 0 0 1 ${196 - i * 6} 100" fill="none" stroke="${c}" stroke-width="6.4" stroke-linecap="round"/>`).join('')
  const el = box(A, 'hap-rainbow', cx, y, w, h, `<svg viewBox="0 0 200 104" width="100%" height="100%" aria-hidden>${arcs}</svg>`)
  const c1 = emo(A, '☁️', cx - w * 0.44, y + h * 0.42, 62 * k)
  const c2 = emo(A, '☁️', cx + w * 0.44, y + h * 0.42, 62 * k)
  ctx.sfx.kirarin()
  const T = 2900
  const fade = [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 1, offset: 0.78 }, { opacity: 0, offset: 1 }]
  void go(ctx, el, fade.map((f, i) => ({ ...f, transform: `translateY(${[14, 0, -4, -10][i]}px) scale(${[0.88, 1, 1.02, 1.04][i]})` })), T)
  void go(ctx, c1, fade, T)
  await go(ctx, c2, fade, T)
})

/** おばけ: はずかしがりのおばけ。顔を出して、目が合うと 赤くなって 消える */
const obake = hap('obake', 'はずかしがりの おばけ', '👻', async (ctx, A) => {
  const k = A.k
  const size = 120 * k
  const y = A.pic ? A.pic.top + A.pic.height * 0.55 : A.h * 0.55
  const g = emo(A, '👻', -size * 0.6, y, size, 'hap-ghost')
  // ほっぺ（目が合ったら ぽっと赤くなる）
  const cheek = (dx: number) => {
    const c = document.createElement('span')
    c.className = 'hap-cheek'
    Object.assign(c.style, { left: `${50 + dx}%`, top: '58%', width: `${size * 0.2}px`, height: `${size * 0.13}px` })
    g.appendChild(c)
    return c
  }
  const c1 = cheek(-26)
  const c2 = cheek(26)
  const T = 2700
  ctx.sfx.pon()
  later(ctx, T * 0.45, () => ctx.sfx.boing())
  void go(ctx, c1, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 0.95, offset: 0.58 }, { opacity: 0.95, offset: 1 }], T)
  void go(ctx, c2, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 0.95, offset: 0.58 }, { opacity: 0.95, offset: 1 }], T)
  await go(
    ctx,
    g,
    track(40, (t) => {
      const inn = ease(clamp(t / 0.25)) // 顔を出す
      const out = ease(clamp((t - 0.72) / 0.2)) // はずかしくて にげる
      const shy = t > 0.45 && t < 0.72 ? 4 * sin((t - 0.45) * 60) : 0 // もじもじ
      const pink = clamp((t - 0.45) / 0.12)
      return { x: size * 1.15 * inn - size * 1.2 * out, r: 8 * inn + shy, s: 1 - 0.35 * out, o: 1 - out, f: `sepia(${pink * 0.9}) saturate(${1 + pink * 3}) hue-rotate(${-pink * 25}deg)` }
    }),
    T,
  )
})

/** おもち: 空から おもちが ぽよんぽよんと 3つ落ちてくる */
const mochi = hap('mochi', 'おもちが ぽよんぽよん', '🍡', async (ctx, A) => {
  const k = A.k
  const w = 62 * k
  const land = A.pic ? A.pic.bottom - 30 * k : A.h * 0.7
  const xs = [0.27, 0.5, 0.73].map((f) => A.w * f)
  const T = 1700
  xs.forEach((x, i) => {
    const m = box(A, 'hap-mochi', x, 0, w, w * 0.82, '<i class="eye l"></i><i class="eye r"></i><i class="chk l"></i><i class="chk r"></i>')
    const delay = i * 480
    later(ctx, delay + 0.38 * T, () => ctx.sfx.bound())
    later(ctx, delay + 0.7 * T, () => ctx.sfx.bound())
    void go(
      ctx,
      m,
      track(40, (t) => {
        // 落ちる → 大きく ぽよん → 小さく ぽよん → のこる → ふわっと消える
        if (t < 0.34) return { y: -40 + (land + 40) * (t / 0.34) ** 2, o: 1 }
        if (t < 0.42) return { y: land, sy: 1 - 0.3 * sin(((t - 0.34) / 0.08) * PI), sx: 1 + 0.18 * sin(((t - 0.34) / 0.08) * PI), o: 1 }
        if (t < 0.64) return { y: land - 70 * k * sin(((t - 0.42) / 0.22) * PI), sy: 1 + 0.08 * sin(((t - 0.42) / 0.22) * PI), o: 1 }
        if (t < 0.72) return { y: land, sy: 1 - 0.2 * sin(((t - 0.64) / 0.08) * PI), sx: 1 + 0.12 * sin(((t - 0.64) / 0.08) * PI), o: 1 }
        if (t < 0.86) return { y: land - 28 * k * sin(((t - 0.72) / 0.14) * PI), o: 1 }
        return { y: land, o: 1 - (t - 0.86) / 0.14 }
      }),
      T,
      delay,
    )
  })
  await wait(T + 2 * 480 + 80)
})

/** くじら: 画面の下から 顔を出して 潮をふく */
const kujira = hap('kujira', 'くじらの しおふき', '🐳', async (ctx, A) => {
  const k = A.k
  const size = 190 * k
  const x = A.w * 0.3
  const y = A.h - size * 0.3
  const T = 2800
  const whale = emo(A, '🐳', x, y, size, 'hap-whale')
  ctx.sfx.pon()
  later(ctx, T * 0.3, () => ctx.sfx.spout())
  void go(
    ctx,
    whale,
    track(40, (t) => {
      const inn = ease(clamp(t / 0.22))
      const out = ease(clamp((t - 0.82) / 0.18))
      return { y: size * 0.7 * (1 - inn + out), r: -4 + 3 * sin(t * 5 * PI) }
    }),
    T,
  )
  // 潮: しぶきが ぴゅーっと上がって 広がって落ちる（やさしい水色の丸）
  const ox = x + size * 0.05
  const oy = y - size * 0.4
  for (let i = 0; i < 16; i++) {
    const a = ((i - 7.5) / 7.5) * 0.55 // 左右にひろがる
    const d = box(A, 'hap-drop', ox, oy, 15 * k, 19 * k)
    const rise = (230 + (i % 3) * 36) * k
    const t0 = 0.3 * T + (i % 4) * 70
    void go(
      ctx,
      d,
      track(24, (t) => ({ x: sin(a) * 120 * k * t, y: -rise * 4 * t * (1 - t) + 40 * k * t * t, o: t < 0.85 ? 1 : (1 - t) / 0.15, s: 0.8 + 0.5 * sin(t * PI) })),
      1100,
      t0,
    )
  }
  await wait(T)
})

/** はと: はとが3羽、てくてく歩いて横切る */
const PIGEON = `<svg viewBox="0 0 64 56" width="100%" height="100%" aria-hidden>
<g class="leg la"><line x1="26" y1="40" x2="26" y2="52" /><path d="M22 52 h8" /></g>
<g class="leg lb"><line x1="36" y1="40" x2="36" y2="52" /><path d="M32 52 h8" /></g>
<ellipse cx="30" cy="30" rx="20" ry="13" fill="#b8bfd0" stroke="#2b1a2e" stroke-width="3"/>
<path d="M12 32 Q4 34 3 42 Q14 40 20 36 Z" fill="#8f97ad" stroke="#2b1a2e" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="34" cy="31" rx="11" ry="7" fill="#9fa8bf" opacity=".7"/>
<circle cx="47" cy="16" r="9.5" fill="#d4d9e6" stroke="#2b1a2e" stroke-width="3"/>
<path d="M40 22 Q44 28 50 24" fill="none" stroke="#7fd0b0" stroke-width="5" stroke-linecap="round" opacity=".85"/>
<path d="M55 15 L63 18 L55 20 Z" fill="#ffb347" stroke="#2b1a2e" stroke-width="2.4" stroke-linejoin="round"/>
<circle cx="50.5" cy="14" r="2.2" fill="#2b1a2e"/>
</svg>`
const hato = hap('hato', 'はとの おさんぽ', '🕊️', async (ctx, A) => {
  const k = A.k
  const w = 76 * k
  const y = A.pic ? A.pic.bottom - w * 0.4 : A.h * 0.7
  const T = 2300
  for (let i = 0; i < 3; i++) {
    const b = box(A, 'hap-pigeon', 0, y, w, w * 0.88, PIGEON)
    later(ctx, i * 360, () => ctx.sfx.coo())
    void go(ctx, b, track(30, (t) => ({ x: lerp(-w, A.w + w, t), y: -3 * k * Math.abs(sin(t * 18 * PI)), r: 3 * sin(t * 18 * PI) })), T, i * 330)
  }
  await wait(T + 2 * 330 + 60)
})

/** ふうせん: ふうせんにつかまった ぶたさんが、ふわふわ上っていく */
const BALLOONS = ['#ff6b8b', '#ffd23f', '#4ab8ff']
const fusen = hap('fusen', 'ふうせんの ぶたさん', '🐷', async (ctx, A) => {
  const k = A.k
  const x0 = A.w * 0.68
  const T = 2900
  const g = box(A, 'hap-fusen', 0, 0, 1, 1)
  const pig = emo(A, '🐷', 0, 0, 62 * k, 'hap-pig')
  g.appendChild(pig)
  BALLOONS.forEach((c, i) => {
    const bx = (i - 1) * 26 * k
    const bl = document.createElement('div')
    bl.className = 'hap-balloon'
    Object.assign(bl.style, { left: `${bx - 17 * k}px`, top: `${-120 * k - Math.abs(i - 1) * -10 * k}px`, width: `${34 * k}px`, height: `${42 * k}px`, background: c })
    const str = document.createElement('div')
    str.className = 'hap-string'
    const len = 98 * k
    Object.assign(str.style, { left: `${bx * 0.5}px`, top: `${-len + 18 * k}px`, height: `${len}px`, transform: `rotate(${(-bx / len) * 28}deg)` })
    g.appendChild(str)
    g.appendChild(bl)
  })
  // pig は g の中の (0,0) 中心
  Object.assign(pig.style, { left: `${-31 * k}px`, top: `${-31 * k}px` })
  ctx.sfx.pon()
  await go(
    ctx,
    g,
    track(50, (t) => ({ x: x0 + 22 * k * sin(t * 3 * PI), y: lerp(A.h + 70 * k, -170 * k, ease(t) * 0.35 + t * 0.65), r: 6 * sin(t * 4 * PI) })),
    T,
  )
})

/** ながれぼし: 流れ星が3つ ながれる（光はやさしく、ゆっくり） */
const nagareboshi = hap('nagareboshi', 'ながれぼし', '🌠', async (ctx, A) => {
  const k = A.k
  const T = 1300
  const starts = [
    [0.92, 0.1],
    [0.78, 0.22],
    [1.0, 0.3],
  ]
  const dx = -A.w * 0.55
  const dy = A.h * 0.2
  const ang = (Math.atan2(-dy, -dx) * 180) / PI // 星からしっぽへの向き
  starts.forEach(([fx, fy], i) => {
    const wrap = box(A, 'hap-meteor', 0, 0, 1, 1)
    const tail = document.createElement('div')
    tail.className = 'hap-tail'
    Object.assign(tail.style, { width: `${150 * k}px`, height: `${9 * k}px`, left: '0', top: `${-4.5 * k}px`, transformOrigin: '0 50%', transform: `rotate(${ang}deg)` })
    const star = emo(A, '⭐', 0, 0, 40 * k, 'hap-star')
    wrap.appendChild(tail)
    wrap.appendChild(star)
    star.style.left = `${-20 * k}px`
    star.style.top = `${-20 * k}px`
    const x0 = A.w * fx
    const y0 = A.h * fy
    later(ctx, i * 520, () => ctx.sfx.sparkle())
    void go(
      ctx,
      wrap,
      track(26, (t) => ({ x: x0 + dx * t, y: y0 + dy * t, o: t < 0.18 ? t / 0.18 : t > 0.7 ? (1 - t) / 0.3 : 1 })),
      T,
      i * 520,
    )
  })
  await wait(T + 2 * 520 + 60)
})

export const HAPPENING_SHOWS: Show[] = [ufo, kirin, kisha, niji, obake, mochi, kujira, hato, fusen, nagareboshi]
export const HAP_IDS = HAPPENING_SHOWS.map((s) => s.id)
