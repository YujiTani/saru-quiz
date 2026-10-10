// ずっこけ: まちがえたとき、司会のおさるが「自分で」変なことをして笑わせる（痛い・こわい表現は使わない）
import type { Show, ShowCtx } from './types'
import { burst } from '../lib/effects'
import { besideHost, bubbleText, ease, hostRect, monkeyOf, track, wait } from './util'

const sin = Math.sin
const cos = Math.cos
const PI = Math.PI
const clamp = (x: number) => Math.max(0, Math.min(1, x))

/** 頭の上の位置（絵文字を置く場所） */
function head(ctx: ShowCtx) {
  const h = hostRect(ctx)
  return { x: h.left + h.width / 2, y: h.top + 8, h }
}

/** バナナの皮ですべる（今までの演出。見た目は変えない） */
const slip: Show = {
  id: 'zukkoke:slip',
  cat: 'zukkoke',
  name: 'つるん',
  icon: '🍌',
  base: true,
  async play(ctx) {
    const monkey = monkeyOf(ctx)
    ctx.sfx.boing()
    if (ctx.host) {
      const peel = document.createElement('span')
      peel.className = 'peel'
      peel.textContent = '🍌'
      ctx.host.appendChild(peel)
      ctx.layer.defer(() => peel.remove())
    }
    if (!monkey) return
    // もとの CSS の slip と同じ動き。次の問題までそのままにする
    await ctx.layer.go(
      monkey,
      [
        { transform: 'none' },
        { transform: 'translateX(10px) rotate(-20deg) translateY(-24px)', offset: 0.25 },
        { transform: 'translateX(14px) rotate(-200deg) translateY(-30px)', offset: 0.55 },
        { transform: 'translateX(16px) rotate(-340deg) translateY(4px)', offset: 0.8 },
        { transform: 'translateX(16px) rotate(-360deg) translateY(6px) scaleY(.9)' },
      ],
      { duration: 900, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' },
    )
  },
}

/** はくしょん: くしゃみで帽子がとんでいき、くるくる回って戻ってくる */
const hakushon: Show = {
  id: 'zukkoke:hakushon',
  cat: 'zukkoke',
  name: 'はくしょん',
  icon: '🎩',
  base: true,
  async play(ctx) {
    const monkey = monkeyOf(ctx)
    const { x, y } = head(ctx)
    // のけぞって、ぐっと前へ
    const lean = monkey
      ? ctx.layer.go(monkey, track(20, (t) => (t < 0.55 ? { r: -12 * ease(t / 0.55), sy: 1 + 0.05 * (t / 0.55) } : t < 0.65 ? { r: 14, sy: 0.88 } : { r: 14 * (1 - ease((t - 0.65) / 0.35)), sy: 0.88 + 0.12 * ease((t - 0.65) / 0.35) })), { duration: 1000, easing: 'linear' })
      : Promise.resolve()
    await wait(550)
    ctx.sfx.achoo()
    void bubbleText(ctx, 'はっ…くしょん！', x + 110, y + 40, 1100)
    const hat = ctx.layer.emoji('🎩', x, y, 34)
    await ctx.layer.go(
      hat,
      track(36, (t) => ({ x: 150 * sin(t * PI), y: -70 * sin(t * PI), r: 720 * ease(t), s: 1 + 0.3 * sin(t * PI) })),
      { duration: 1500, easing: 'linear', fill: 'forwards' },
    )
    await lean
    await wait(350)
    hat.remove()
  },
}

/** ぐるぐる: その場でくるくる回って、頭の上で 💫 がまわる */
const guruguru: Show = {
  id: 'zukkoke:guruguru',
  cat: 'zukkoke',
  name: 'ぐるぐる',
  icon: '💫',
  hint: '2にち あそぶ',
  unlock: (u) => u.playDays >= 2,
  async play(ctx) {
    const monkey = monkeyOf(ctx)
    const { x, y } = head(ctx)
    const T = 1800
    ctx.sfx.boing()
    const stars = [0, 1, 2].map((k) => {
      const el = ctx.layer.emoji('💫', x, y - 2, 24)
      return ctx.layer.go(el, track(40, (t) => ({ x: cos(k * ((2 * PI) / 3) + t * 4 * PI) * 30, y: sin(k * ((2 * PI) / 3) + t * 4 * PI) * 9, o: t > 0.88 ? (1 - t) / 0.12 : 1 })), { duration: T, easing: 'linear' }, true)
    })
    const spin = monkey
      ? ctx.layer.go(monkey, track(30, (t) => ({ r: 720 * ease(Math.min(1, t / 0.75)), y: -4 * sin(t * PI) })).map((k) => ({ ...k, transformOrigin: '50% 60%' })), { duration: T, easing: 'linear' }) // 足もとではなく真ん中で回る
      : Promise.resolve()
    await Promise.all([...stars, spin])
  },
}

/** ひよこ: 頭の上に 🐤 がぴょこんと乗って、ぴよぴよはねる */
const hiyoko: Show = {
  id: 'zukkoke:hiyoko',
  cat: 'zukkoke',
  name: 'ぴよぴよ',
  icon: '🐤',
  hint: '4にち あそぶ',
  unlock: (u) => u.playDays >= 4,
  async play(ctx) {
    const { x, y } = head(ctx)
    const chick = ctx.layer.emoji('🐤', x, y - 10, 32)
    const T = 2000
    for (const [i, at] of [0.3, 0.46, 0.62, 0.78].entries()) {
      setTimeout(() => {
        ctx.sfx.peep()
        if (i === 1) void bubbleText(ctx, 'ぴよぴよ', x + 66, y - 36, 900)
      }, at * T)
    }
    await ctx.layer.go(
      chick,
      track(50, (t) => {
        if (t < 0.25) return { y: -110 * (1 - (t / 0.25) ** 2), s: 1 }
        if (t < 0.3) return { y: 0, sy: 0.8, sx: 1.15 } // ぽこっと着地
        const u = (t - 0.3) / 0.16
        return { y: -16 * Math.abs(sin(u * PI)), r: sin(u * PI * 2) * 8, o: t > 0.9 ? (1 - t) / 0.1 : 1 }
      }),
      { duration: T, easing: 'linear' },
      true,
    )
  },
}

/** はなバナナ: 鼻から🍌がにゅっと出て、ぽんっと抜けて飛んでいく */
const hanabanana: Show = {
  id: 'zukkoke:hanabanana',
  cat: 'zukkoke',
  name: 'はなから バナナ',
  icon: '👃',
  hint: '6にち あそぶ',
  unlock: (u) => u.playDays >= 6,
  async play(ctx) {
    const monkey = monkeyOf(ctx)
    const h = hostRect(ctx)
    const nx = h.left + h.width * 0.56
    const ny = h.top + h.height * 0.55
    const banana = ctx.layer.emoji('🍌', nx + 8, ny, 46)
    const side = besideHost(ctx, 64)
    const T = 2200
    // 鼻がむずむず（ちょっとだけ縮む）
    if (monkey) void ctx.layer.go(monkey, track(20, (t) => ({ sy: 1 - 0.05 * sin(clamp(t / 0.5) * PI), sx: 1 + 0.03 * sin(clamp(t / 0.5) * PI) })), { duration: 1100, easing: 'linear' })
    setTimeout(() => void bubbleText(ctx, 'にゅ〜', side.x, side.y, 800), 150)
    setTimeout(() => {
      ctx.sfx.pon()
      burst(nx + 16, ny, 'star', 8, 0.7)
      void bubbleText(ctx, 'ぽんっ！', side.x, side.y, 800)
    }, T * 0.5)
    banana.style.transformOrigin = '0% 60%'
    await ctx.layer.go(
      banana,
      track(60, (t) => {
        if (t < 0.5) {
          const k = ease(t / 0.5) // にゅっ…と 出てくる
          return { x: 30 * k, y: -2 * k, sx: 0.15 + 0.85 * k, sy: 0.5 + 0.5 * k, r: -14 * k + sin(t * 40) * 2 * k, o: Math.min(1, t * 8) }
        }
        const u = (t - 0.5) / 0.5 // ぽんっ！ と飛んでいく
        return { x: 30 + 150 * u, y: -2 - 110 * 4 * u * (1 - u) + 40 * u * u, r: -14 + 720 * u, o: u > 0.85 ? (1 - u) / 0.15 : 1 }
      }),
      { duration: T, easing: 'linear' },
      true,
    )
  },
}

/** ぐにゃぐにゃ: たこのように、ぐにゃぐにゃ */
const gunya: Show = {
  id: 'zukkoke:gunya',
  cat: 'zukkoke',
  name: 'ぐにゃぐにゃ',
  icon: '🐙',
  hint: '8にち あそぶ',
  unlock: (u) => u.playDays >= 8,
  async play(ctx) {
    const monkey = monkeyOf(ctx)
    if (!monkey) return
    const T = 2200
    const side = besideHost(ctx, 64)
    ctx.sfx.boing()
    setTimeout(() => void bubbleText(ctx, 'ぐにゃ〜', side.x, side.y, 1000), 200)
    ;(monkey as HTMLElement).style.transformOrigin = '50% 100%'
    const kf: Keyframe[] = Array.from({ length: 81 }, (_, i) => {
      const t = i / 80
      const a = sin(t * PI) // ゆれの大きさ（はじめと終わりは小さく）
      const skew = 20 * a * sin(t * 6 * PI)
      const sy = 1 + 0.22 * a * sin(t * 4 * PI + 1)
      const sx = 1 - 0.14 * a * sin(t * 4 * PI + 1) + 0.06 * a * cos(t * 5 * PI)
      return { offset: t, transform: `skewX(${skew}deg) skewY(${6 * a * cos(t * 5 * PI)}deg) scale(${sx}, ${sy})` }
    })
    await ctx.layer.go(monkey, kf, { duration: T, easing: 'linear' })
  },
}

/** ぷりっ: 後ろを向いて、おしりを ぷりっ と ふる（かわいく） */
const puri: Show = {
  id: 'zukkoke:puri',
  cat: 'zukkoke',
  name: 'ぷりっ',
  icon: '💨',
  hint: '10にち あそぶ',
  unlock: (u) => u.playDays >= 10,
  async play(ctx) {
    const monkey = monkeyOf(ctx)
    if (!monkey) return
    const T = 2400
    const side = besideHost(ctx, 64)
    ;(monkey as HTMLElement).style.transformOrigin = '50% 100%'
    for (const at of [0.38, 0.55, 0.72]) {
      setTimeout(() => {
        ctx.sfx.bound()
        void bubbleText(ctx, 'ぷりっ', side.x, side.y, 600)
      }, at * T)
    }
    await ctx.layer.go(
      monkey,
      track(80, (t) => {
        const turn = t < 0.2 ? ease(t / 0.2) : t > 0.88 ? 1 - ease((t - 0.88) / 0.12) : 1 // 後ろを向く
        const wig = t > 0.3 && t < 0.8 ? sin(((t - 0.3) / 0.5) * 3 * 2 * PI) : 0 // おしりを ふりふり
        return { sx: 1 - 2 * turn, r: 12 * turn + wig * 10, y: 4 * turn, sy: 1 - 0.04 * turn }
      }),
      { duration: T, easing: 'linear' },
    )
  },
}

/** ねこ: 🐈 が出てきて、おさるが追いかけられて 画面を一周して もどってくる（楽しい追いかけっこ） */
const neko: Show = {
  id: 'zukkoke:neko',
  cat: 'zukkoke',
  name: 'おいかけっこ',
  icon: '🐈',
  hint: '12にち あそぶ',
  unlock: (u) => u.playDays >= 12,
  async play(ctx) {
    const monkey = monkeyOf(ctx) as HTMLElement | null
    if (!monkey) return
    const h = hostRect(ctx)
    const hx = h.left + h.width / 2
    const hy = h.top + h.height / 2
    const W = innerWidth
    const H = innerHeight
    // 画面をぐるっと一周する四角い道
    const pts: [number, number][] = [[hx, hy], [W - 36, hy], [W - 36, H * 0.8], [36, H * 0.8], [36, hy], [hx, hy]]
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
    const total = lens.reduce((a, b) => a + b, 0)
    const at = (s: number): [number, number] => {
      let d = Math.max(0, Math.min(1, s)) * total
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i]) return [pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * d) / lens[i], pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * d) / lens[i]]
        d -= lens[i]
      }
      return pts[pts.length - 1]
    }
    const mk = ctx.layer.cloneOf(monkey)
    monkey.style.opacity = '0'
    ctx.layer.defer(() => (monkey.style.opacity = ''))
    const cat = ctx.layer.emoji('🐈', hx, hy, 46)
    const T = 3000
    const GAP = 0.1 // ねこは おさるの少し後ろ
    const END = 1 + GAP + 0.06
    setTimeout(() => {
      ctx.sfx.meow()
      void bubbleText(ctx, 'にゃー', besideHost(ctx, 64).x, besideHost(ctx, 64).y, 700)
    }, 80)
    const pos = (u: number, who: 'monkey' | 'cat') => {
      if (who === 'monkey') return at(u)
      const p = u - GAP
      if (p < 0) return [-40 + (hx + 40) * (1 + p / GAP), hy] as [number, number] // 左から走ってくる
      if (p <= 1) return at(p)
      return [hx - (hx + 60) * ((p - 1) / 0.06), hy] as [number, number] // 追いついたら 左へ去っていく
    }
    const run = (who: 'monkey' | 'cat') =>
      track(120, (t) => {
        const u = t * END
        const [x, y] = pos(u, who)
        const [px] = pos(Math.max(0, u - 0.01), who)
        const bob = Math.abs(sin(t * 70)) * (who === 'cat' ? 7 : 9)
        const face = x >= px ? 1 : -1
        return who === 'monkey' ? { x: x - hx, y: y - hy - bob, r: sin(t * 70) * 7, sx: 1 } : { x: x - hx, y: y - hy - bob, sx: -face, o: u < 0.005 ? 0 : 1 }
      })
    await Promise.all([
      ctx.layer.go(mk, run('monkey'), { duration: T, easing: 'linear' }, true),
      ctx.layer.go(cat, run('cat'), { duration: T, easing: 'linear' }, true),
    ])
    monkey.style.opacity = ''
  },
}

export const ZUKKOKE_SHOWS: Show[] = [slip, hakushon, guruguru, hiyoko, hanabanana, gunya, puri, neko]
