// うごくえ: 正解したとき、絵がそのことばらしく動く（絵の複製を動かして、元の絵はその間だけ透明にする）
import { drift } from '../lib/effects'
import type { Show } from './types'
import { bubbleText, centerOf, ease, every, hostRect, monkeyOf, pop, puff, track, wait, withClone } from './util'
import { dougu, fuku, gakki, hana, hito, ie, karada, katachi, kisetsu, machi, omocha, own, hint, sports, tenki } from './ugokuMore'
const sin = Math.sin
const PI = Math.PI

/** 基本: その場でくるっと回って、ぴかっと光る */
const pika: Show = {
  id: 'ugoku:pika',
  cat: 'ugoku',
  name: 'ぴかっ',
  icon: '✨',
  base: true,
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c) => {
      await ctx.layer.go(
        c,
        track(24, (t) => {
          const glow = Math.max(0, sin(((t - 0.45) / 0.4) * PI)) // ひと呼吸だけ光る（1回）
          return { r: 360 * ease(Math.min(1, t / 0.7)), s: 1 + 0.12 * sin(t * PI), f: `brightness(${1 + 0.6 * glow}) drop-shadow(0 0 ${18 * glow}px #fff6a0)` }
        }),
        { duration: 850 },
      )
    })
  },
}

/** どうぶつ: ぴょんぴょん3回はねて、画面の右の外へ */
const doubutsu: Show = {
  id: 'ugoku:doubutsu',
  cat: 'ugoku',
  name: 'ぴょんぴょん',
  icon: '🐰',
  forCat: 'どうぶつ',
  hint: hint('どうぶつ'),
  unlock: own('どうぶつ'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const dx = innerWidth - from.left + 20
      const hop = Math.min(70, from.top - 70)
      const timers = [0, 1, 2].map((i) => setTimeout(() => ctx.sfx.tap(), (i * 1500) / 3))
      ctx.layer.defer(() => timers.forEach(clearTimeout))
      await ctx.layer.go(
        c,
        track(48, (t) => {
          const u = (t * 3) % 1
          const squash = u < 0.08 || u > 0.94 ? 0.9 : 1
          return { x: dx * t, y: -Math.max(20, hop) * 4 * u * (1 - u), r: sin(t * 3 * 2 * PI) * 8, sy: squash, sx: 2 - squash }
        }),
        { duration: 1500, easing: 'linear' },
        true,
      )
    })
  },
}

/** とり: 左右にゆれながら上へ飛んでいく。羽根が数枚落ちてくる */
const tori: Show = {
  id: 'ugoku:tori',
  cat: 'ugoku',
  name: 'ぱたぱた',
  icon: '🐦',
  forCat: 'とり',
  hint: hint('とり'),
  unlock: own('とり'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const up = from.top + from.height + 40
      const stop = every(ctx, 220, () => {
        const p = centerOf(c.getBoundingClientRect())
        drift('feather', p.x, p.y, 1, 24)
      })
      await ctx.layer.go(
        c,
        track(40, (t) => ({ x: sin(t * 6 * PI) * 44, y: -up * t ** 1.6, r: sin(t * 6 * PI) * 14, s: 1 - 0.3 * t })),
        { duration: 1700, easing: 'linear' },
        true,
      )
      stop()
    })
  },
}

/** うみのいきもの: うすい水色の層がふわっとかかり、泡と一緒に泳いで横へ出ていく */
const umi: Show = {
  id: 'ugoku:umi',
  cat: 'ugoku',
  name: 'すいすい',
  icon: '🐟',
  forCat: 'うみのいきもの',
  hint: hint('うみのいきもの'),
  unlock: own('うみのいきもの'),
  async play(ctx) {
    pop(ctx)
    const water = document.createElement('div')
    water.className = 'show-water'
    ctx.layer.add(water)
    void ctx.layer.go(water, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1500, easing: 'ease-in-out' }, true)
    await withClone(ctx, async (c, from) => {
      const dx = innerWidth - from.left + 20
      const stop = every(ctx, 130, () => {
        const p = centerOf(c.getBoundingClientRect())
        drift('bubble', p.x - 20, p.y, 1, 14)
      })
      await ctx.layer.go(
        c,
        track(40, (t) => ({ x: dx * ease(t) * 0.9 + dx * 0.1 * t, y: sin(t * 4 * PI) * 22, r: sin(t * 4 * PI + 1) * 9 })),
        { duration: 1800, easing: 'linear' },
        true,
      )
      stop()
    })
  },
}

/** むし: 小さくなって、ちょこちょこ歩いて、司会のおさるの頭にとまって消える */
const mushi: Show = {
  id: 'ugoku:mushi',
  cat: 'ugoku',
  name: 'ちょこちょこ',
  icon: '🐛',
  forCat: 'むし',
  hint: hint('むし'),
  unlock: own('むし'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const me = centerOf(from)
      const h = hostRect(ctx)
      const dx = h.left + h.width / 2 - me.x
      const dy = h.top - 6 - me.y
      const S = 0.3
      await ctx.layer.go(
        c,
        track(60, (t) => {
          const w = Math.min(1, t / 0.72) // 歩く間
          const step = w < 1 ? Math.abs(sin(w * 22 * PI)) : 0 // 小刻みなはね
          const rest = t > 0.72 ? sin((t - 0.72) * 40 * PI) * 5 : 0 // とまって、ちょっとゆれる
          return {
            x: dx * ease(w),
            y: dy * ease(w) - step * 7,
            r: w < 1 ? sin(w * 22 * PI) * 10 : rest,
            s: 1 - (1 - S) * Math.min(1, t / 0.15),
            o: t > 0.9 ? (1 - t) / 0.1 : 1,
          }
        }),
        { duration: 2300, easing: 'linear' },
        true,
      )
    })
  },
}

/** のりもの: うしろに下がって「ため」て、横へ走り去る。うしろにけむり */
const norimono: Show = {
  id: 'ugoku:norimono',
  cat: 'ugoku',
  name: 'ぶーん',
  icon: '🚗',
  forCat: 'のりもの',
  hint: hint('のりもの'),
  unlock: own('のりもの'),
  async play(ctx) {
    pop(ctx)
    await withClone(ctx, async (c, from) => {
      const dx = innerWidth - from.left + 40
      const back = -34
      const T = 1700
      setTimeout(() => ctx.sfx.vroom(), 450)
      const t0 = performance.now()
      const stop = every(ctx, 70, () => {
        if (performance.now() - t0 < T * 0.34) return // ためている間は出さない
        const r = c.getBoundingClientRect()
        puff(ctx, r.left + r.width * 0.08, r.top + r.height * 0.68, 22 + ctx.rng() * 18) // 絵のうしろ（車輪のあたり）
      })
      await ctx.layer.go(
        c,
        track(50, (t) => {
          if (t < 0.26) return { x: back * ease(t / 0.26), sx: 1 + 0.06 * (t / 0.26), sy: 1 - 0.06 * (t / 0.26) } // ぐっと下がって、ためる
          if (t < 0.34) return { x: back, sx: 1.06, sy: 0.94 }
          const u = (t - 0.34) / 0.66
          return { x: back + (dx - back) * u ** 2.2, sx: 1 + 0.08 * u, sy: 1 }
        }),
        { duration: T, easing: 'linear' },
        true,
      )
      stop()
    })
  },
}

/** くだもの・やさい・たべもの: おさるのほうへ飛んでいき、ぱくっ。3回かじられてなくなる */
function eat(id: string, cat: string, name: string, icon: string, chew: string): Show {
  return {
    id,
    cat: 'ugoku',
    name,
    icon,
    forCat: cat,
    hint: hint(cat),
    unlock: own(cat),
    async play(ctx) {
      pop(ctx)
      await withClone(ctx, async (c, from) => {
        const me = centerOf(from)
        const h = hostRect(ctx)
        const tx = h.left + h.width / 2 + 56
        const ty = h.top + h.height / 2
        const dx = tx - me.x
        const dy = ty - me.y
        const S = 0.34
        const monkey = monkeyOf(ctx)
        await ctx.layer.go(
          c,
          track(30, (t) => ({ x: dx * ease(t), y: dy * ease(t) - 60 * sin(t * PI), r: 360 * ease(t), s: 1 - (1 - S) * ease(t) })),
          { duration: 650, easing: 'linear', fill: 'forwards' },
        )
        // 3回に分けてかじる（おさるの側から欠けていく）
        for (let i = 0; i < 3; i++) {
          const cut = (k: number) => `inset(0 0 0 ${k * 34}% round 30px)`
          ctx.sfx.munch()
          if (monkey) void ctx.layer.go(monkey, track(8, (t) => ({ sx: 1 + 0.1 * sin(t * 3 * PI), sy: 1 - 0.06 * sin(t * 3 * PI) })), { duration: 420 })
          await Promise.all([
            ctx.layer.go(c, [{ clipPath: cut(i) }, { clipPath: cut(i + 1) }], { duration: 160, easing: 'ease-out', fill: 'forwards' }),
            bubbleText(ctx, i === 0 ? 'ぱくっ' : chew, h.left + h.width + 34, h.top - 10, 560),
          ])
          await wait(i === 2 ? 60 : 280)
        }
      })
    },
  }
}

// questions.json の categories の順（図鑑にもこの順で並ぶ）
export const UGOKU_SHOWS: Show[] = [
  pika,
  eat('ugoku:kudamono', 'くだもの', 'ぱくっ くだもの', '🍎', 'もぐもぐ'),
  eat('ugoku:yasai', 'やさい', 'ぱくっ やさい', '🥕', 'しゃりしゃり'),
  eat('ugoku:tabemono', 'たべもの', 'ぱくっ たべもの', '🍙', 'むしゃむしゃ'),
  doubutsu,
  tori,
  umi,
  mushi,
  norimono,
  ie,
  fuku,
  karada,
  katachi,
  tenki,
  hana,
  omocha,
  gakki,
  dougu,
  machi,
  hito,
  sports,
  kisetsu,
]
