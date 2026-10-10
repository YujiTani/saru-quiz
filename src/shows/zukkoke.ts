// ずっこけ: まちがえたとき、司会のおさるが「自分で」変なことをして笑わせる（痛い・こわい表現は使わない）
import type { Show, ShowCtx } from './types'
import { bubbleText, ease, hostRect, monkeyOf, track, wait } from './util'

const sin = Math.sin
const cos = Math.cos
const PI = Math.PI

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

export const ZUKKOKE_SHOWS: Show[] = [slip, hakushon, guruguru, hiyoko]
