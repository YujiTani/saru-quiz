// ふぃなーれの のこり3種。クリアのあと、結果の前に出る。長さは演出ごとに ちがう（maxMs。Quiz はこの時間で結果へ進む）
//  ことばパレード: このプレイで正解した単語が、おさるを先頭に 1列で画面を横切る。1つずつ読み上げ（最大8語・8秒以内）
//  バナナのき どさー: ゴールの木が 大きく出て ゆさゆさゆれ、バナナが どさーっと落ちて おさるが受けとめる（4秒）
//  ロケットはっしゃ: バナナのロケットに おさるが乗って 3・2・1 → 夜空へ → 星になって キラッと（1回だけ。4秒）
import { burst, rain } from '../lib/effects'
import { getCurrent } from '../lib/players'
import type { Question } from '../lib/quiz'
import { spriteUrl, type CharId } from '../sprites/monkeys'
import { wordArt } from './finale'
import type { Show, ShowCtx } from './types'
import { centerOf, ease, track, wait } from './util'

const sin = Math.sin
const PI = Math.PI
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))

const div = (cls: string, parent?: HTMLElement) => {
  const el = document.createElement('div')
  el.className = cls
  parent?.appendChild(el)
  return el
}

function later(ctx: ShowCtx, ms: number, f: () => void) {
  const t = setTimeout(f, ms)
  ctx.layer.defer(() => clearTimeout(t))
}

const sprite = (char: CharId, size: number, cls = '') => {
  const img = document.createElement('img')
  img.className = `pixel ${cls}`
  img.src = spriteUrl(char, 'happy')
  img.alt = ''
  img.draggable = false
  img.style.width = `${size}px`
  return img
}

/** 動きの強さ 0: 大きな絵文字が ふわっと出て消えるだけ */
async function still(ctx: ShowCtx, icon: string) {
  const scene = div('fin-scene')
  const e = div('fin-still', scene)
  e.textContent = icon
  ctx.layer.add(scene)
  await fadeInOut(scene, 1400)
  scene.remove()
}

/** その場で ふわっと出て、ふわっと消える（動きの強さ 0 用） */
const fadeInOut = (el: HTMLElement, ms: number) =>
  el
    .animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: ms, easing: 'ease-in-out' })
    .finished.then(
      () => {},
      () => {},
    )

/** 舞台の中心の高さ（問題の絵のまんなか。なければ 画面の 48%） */
const midY = (ctx: ShowCtx) => (ctx.pic ? centerOf(ctx.pic.getBoundingClientRect()).y : innerHeight * 0.48)

// ---- ことばパレード ----
export const PARADE_MAX = 8 // 語
const PARADE_STEP = 170 // 行列の間かく（px）
const PARADE_SPEED = 250 // 進む速さ（px/秒）。1語あたり 0.68 秒で次の語が真ん中を通る
const PARADE_PAD = 200 // 画面の外から外まで進むのに足す長さ（px。ひとり分の幅ぶん）

/** パレードの長さ（ms）。n 語、画面の幅 w のとき。8語・幅390で 8秒以内 */
export const paradeMs = (n: number, w = 390): number => Math.round(((w + PARADE_PAD + Math.min(PARADE_MAX, n) * PARADE_STEP) / PARADE_SPEED) * 1000)

const parade: Show = {
  id: 'finale:parade',
  cat: 'finale',
  name: 'ことばパレード',
  icon: '🎺',
  hint: 'コースを 2かい クリア',
  unlock: (u) => u.clears >= 2,
  maxMs: 8500,
  async play(ctx) {
    const words: Question[] = (ctx.today ?? []).slice(-PARADE_MAX)
    if (words.length === 0) return
    if (ctx.motion <= 0) {
      // 動きの強さ 0: 1つずつ ふわっと出して 読み上げるだけ
      for (const q of words) {
        const scene = div('fin-scene')
        const c = div('parade-card', scene)
        c.appendChild(wordArt(q))
        ctx.layer.add(scene)
        void ctx.speak(q.a)
        await fadeInOut(scene, 800)
        scene.remove()
      }
      return
    }
    const L = ctx.layer
    const W = innerWidth
    const y = midY(ctx)
    const scene = div('fin-scene parade-scene')
    const dim = div('fin-dim', scene)
    const road = div('parade-road', scene)
    road.style.top = `${y + 22}px`
    L.add(scene)
    void L.go(dim, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.94 }, { opacity: 0 }], { duration: paradeMs(words.length, W) })
    void L.go(road, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.94 }, { opacity: 0 }], { duration: paradeMs(words.length, W) })
    const char = getCurrent()?.char ?? 'monchan'
    const travel = ((W + PARADE_PAD) / PARADE_SPEED) * 1000 // 1人が画面を横切る時間
    const items: HTMLElement[] = []
    // 先頭: おさる（旗をもつ）
    const lead = div('parade-item parade-lead', scene)
    lead.appendChild(sprite(char, 66))
    const flag = div('parade-flag', lead)
    flag.textContent = '🚩'
    items.push(lead)
    words.forEach((q) => {
      const it = div('parade-item', scene)
      const card = div('parade-card', it)
      card.appendChild(wordArt(q))
      items.push(it)
    })
    ctx.sfx.fanfare()
    rain('confetti', 50)
    items.forEach((it, k) => {
      const delay = ((k * PARADE_STEP) / PARADE_SPEED) * 1000
      it.style.top = `${y - 44}px`
      it.style.left = '0'
      void L.go(it, track(36, (t) => ({ x: -100 + (W + PARADE_PAD) * t, y: -7 * Math.abs(sin((t * travel * PI) / 340)), r: 3 * sin((t * travel * PI) / 340) })), { duration: travel, delay, easing: 'linear', fill: 'both' }, true)
      if (k >= 1) {
        const q = words[k - 1]
        // 画面のまんなかを通るとき 読み上げる
        later(ctx, delay + travel * ((W / 2 + 100) / (W + PARADE_PAD)), () => {
          it.classList.add('is-speaking')
          ctx.sfx.bound()
          void ctx.speak(q.a)
        })
      }
    })
    await wait(paradeMs(words.length, W) + 100)
    scene.remove()
  },
}

// ---- バナナのき どさー ----
const TREE_MS = 4000
const bananatree: Show = {
  id: 'finale:bananatree',
  cat: 'finale',
  name: 'バナナのき どさー',
  icon: '🌴',
  hint: 'バナナを 1500こ ためる',
  unlock: (u) => u.coins >= 1500,
  maxMs: 4500,
  async play(ctx) {
    if (ctx.motion <= 0) return still(ctx, '🌴')
    const L = ctx.layer
    const W = innerWidth
    const H = innerHeight
    const scene = div('fin-scene')
    const dim = div('fin-dim light', scene)
    const size = Math.min(W * 0.84, 340)
    const cx = W / 2
    const ground = H * 0.78
    const tree = div('tree-wrap', scene)
    Object.assign(tree.style, { left: `${cx - size / 2}px`, top: `${ground - size * 1.02}px`, width: `${size}px`, height: `${size}px`, transformOrigin: '50% 100%' })
    const palm = div('tree-palm', tree)
    palm.textContent = '🌴'
    palm.style.fontSize = `${size * 0.9}px`
    // 木になっているバナナ（葉のあたりに ぶらさがる）
    const spots = [
      [0.42, 0.26],
      [0.55, 0.22],
      [0.35, 0.34],
      [0.62, 0.32],
      [0.48, 0.36],
      [0.28, 0.27],
      [0.7, 0.26],
      [0.52, 0.3],
      [0.4, 0.2],
      [0.6, 0.38],
    ]
    const hung = spots.map(([fx, fy]) => {
      const b = div('tree-banana', tree)
      b.textContent = '🍌'
      Object.assign(b.style, { left: `${fx * size}px`, top: `${fy * size}px`, fontSize: `${size * 0.11}px` })
      return b
    })
    // 下で まっているおさるたち
    const chars: CharId[] = [getCurrent()?.char ?? 'monchan', 'sora', 'mint']
    const monkeys = chars.map((c, i) => {
      const m = div('tree-monkey', scene)
      m.appendChild(sprite(c, 56))
      Object.assign(m.style, { left: `${cx + (i - 1) * 96 - 28}px`, top: `${ground - 40}px` })
      return m
    })
    L.add(scene)
    ctx.sfx.whoosh()
    void L.go(dim, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: TREE_MS })
    // 木が ぼよんと大きく出る → ゆさゆさゆれる（1回ごとに大きく）
    void L.go(
      tree,
      track(40, (t) => {
        const ms = t * TREE_MS
        if (ms < 450) return { s: 0.3 + 0.8 * ease(ms / 450) * (1 + 0.1 * sin((ms / 450) * PI)), o: clamp(ms / 200) }
        if (ms < 1750) {
          const u = (ms - 450) / 1300
          return { s: 1, r: 7 * u * sin(u * 6 * PI), o: 1 }
        }
        const fade = clamp((ms - 3600) / 400)
        return { s: 1, r: 0, o: 1 - fade }
      }),
      { duration: TREE_MS, easing: 'linear', fill: 'both' },
    )
    // ぜんぶ どさー！
    later(ctx, 1750, () => {
      ctx.sfx.rumble()
      rain('banana', 70)
      hung.forEach((b, i) => {
        const r = b.getBoundingClientRect()
        const x = r.left + r.width / 2
        const y0 = r.top + r.height / 2
        const f = div('tree-fall', scene)
        f.textContent = '🍌'
        Object.assign(f.style, { left: `${x - r.width / 2}px`, top: `${y0 - r.height / 2}px`, fontSize: b.style.fontSize })
        b.style.visibility = 'hidden'
        const land = ground + 6 - (i % 3) * 8
        const dx = (i - 4.5) * 9
        void L.go(f, track(24, (t) => ({ x: dx * t, y: (land - y0) * t * t, r: 200 * t, o: 1 })), { duration: 650 + (i % 4) * 70, delay: i * 40, easing: 'linear', fill: 'both' })
      })
      // おさるたち: とびはねて よろこぶ
      monkeys.forEach((m, i) => {
        later(ctx, i * 90, () => ctx.sfx.boing())
        void L.go(m, track(30, (t) => ({ y: -34 * Math.abs(sin(t * 3 * PI)), r: 6 * sin(t * 6 * PI), o: t > 0.85 ? (1 - t) / 0.15 : 1 })), { duration: 1700, delay: i * 90, easing: 'linear', fill: 'both' })
      })
      later(ctx, 700, () => ctx.sfx.coinCascade(8))
    })
    await wait(TREE_MS + 80)
    scene.remove()
  },
}

// ---- ロケットはっしゃ ----
const ROCKET_MS = 4000
const rocket: Show = {
  id: 'finale:rocket',
  cat: 'finale',
  name: 'ロケットはっしゃ',
  icon: '🚀',
  hint: 'コースを 5かい クリア',
  unlock: (u) => u.clears >= 5,
  maxMs: 4500,
  async play(ctx) {
    if (ctx.motion <= 0) return still(ctx, '🚀')
    const L = ctx.layer
    const W = innerWidth
    const H = innerHeight
    const scene = div('fin-scene')
    const sky = div('rocket-sky', scene)
    const stars = div('rocket-stars', scene)
    const cx = W / 2
    const baseY = H * 0.7
    const rk = div('rocket', scene)
    Object.assign(rk.style, { left: `${cx - 55}px`, top: `${baseY - 80}px` })
    const body = div('rocket-body', rk)
    body.textContent = '🍌'
    const rider = sprite(getCurrent()?.char ?? 'monchan', 44, 'rocket-rider')
    rk.appendChild(rider)
    const flame = div('rocket-flame', rk)
    flame.style.opacity = '0'
    const count = div('rocket-count', scene)
    const star = div('rocket-star', scene)
    star.textContent = '⭐'
    star.style.opacity = '0'
    Object.assign(star.style, { left: `${cx - 28}px`, top: `${H * 0.16}px` })
    L.add(scene)
    void L.go(sky, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: ROCKET_MS, fill: 'both' })
    void L.go(stars, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: ROCKET_MS, fill: 'both' })
    // 3・2・1（やさしい数字。1つ 0.42 秒）
    const t0 = 330
    const tick = 420
    for (const [i, n] of [3, 2, 1].entries()) {
      later(ctx, t0 + i * tick, () => {
        count.textContent = String(n)
        ctx.sfx.tick(false)
        void L.go(count, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.5)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.3 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.9)' }], { duration: tick })
      })
    }
    const launch = t0 + 3 * tick + 60 // 1650
    later(ctx, launch, () => {
      count.textContent = ''
      flame.style.opacity = '1'
      ctx.sfx.vroom()
      // けむり（下に のこる）
      for (let i = 0; i < 9; i++) {
        later(ctx, i * 80, () => {
          const r = rk.getBoundingClientRect()
          const p = div('show-puff', scene)
          const s = 26 + (i % 3) * 8
          Object.assign(p.style, { left: `${r.left + r.width / 2 - s / 2 + (i % 2 ? 8 : -8)}px`, top: `${r.bottom - 6}px`, width: `${s}px`, height: `${s}px` })
          void L.go(p, [{ opacity: 0.9, transform: 'scale(.5)' }, { opacity: 0, transform: 'translateY(26px) scale(2.2)' }], { duration: 800, easing: 'ease-out' })
        })
      }
    })
    // ゆれる → とびたつ
    void L.go(
      rk,
      track(40, (t) => {
        const ms = t * ROCKET_MS
        if (ms < launch) return { r: 2.5 * sin(ms / 28) * clamp((ms - t0) / 400), y: 0, o: clamp(ms / 200) }
        const u = clamp((ms - launch) / 1350)
        return { y: -(baseY + 160) * u * u, s: 1 - 0.45 * u, r: 0, o: 1 }
      }),
      { duration: ROCKET_MS, easing: 'linear', fill: 'both' },
      false,
    )
    // 星になって キラッ（1回だけ）
    const twinkle = launch + 1300
    later(ctx, twinkle, () => {
      ctx.sfx.kirarin()
      star.style.opacity = '1'
      burst(cx, H * 0.16 + 28, 'star', 12, 0.7)
      void L.go(star, [{ opacity: 0, transform: 'scale(.2) rotate(0deg)' }, { opacity: 1, transform: 'scale(1.6) rotate(72deg)', offset: 0.45 }, { opacity: 1, transform: 'scale(1) rotate(144deg)', offset: 1 }], { duration: 700, easing: 'ease-out', fill: 'both' })
    })
    await wait(ROCKET_MS + 80)
    scene.remove()
  },
}

export const FINALE_MORE: Show[] = [parade, bananatree, rocket]
