// ふぃなーれ: クリアしたあと、結果の前に出す演出。全体で4秒以内
//  きねんしゃしん: 画面が暗くなる → おさると今日の ことばが ひな壇に並ぶ →「はい、ちーず！」→ 3・2・1 → フラッシュ（1回だけ・ゆっくり消す）→ 写真の枠が ぺたっと貼られる
import { dayKey, now } from '../lib/day'
import { fmtDay } from '../lib/calendar'
import { getCurrent } from '../lib/players'
import { MONKEY_SLOT, PHOTO_MAX, riserLayout, type Slot } from '../lib/riser'
import type { Question } from '../lib/quiz'
import { spriteUrl } from '../sprites/monkeys'
import type { Show, ShowCtx } from './types'
import { wait } from './util'

/** 写真の中の1つ（絵）を置く。slot は枠の中の割合 */
export function placeItem(el: HTMLElement, s: Slot) {
  Object.assign(el.style, { position: 'absolute', left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.size * 100}%` })
}

/** ことばの絵（なければ仮の絵文字）の入れ物 */
export function wordArt(q: Question): HTMLElement {
  const box = document.createElement('div')
  box.className = 'photo-word'
  if (q.img) {
    const img = document.createElement('img')
    img.src = q.img
    img.alt = ''
    img.draggable = false
    box.appendChild(img)
  } else {
    const e = document.createElement('span')
    e.className = 'emoji'
    e.textContent = q.e ?? ''
    box.appendChild(e)
  }
  return box
}

const div = (cls: string, parent?: HTMLElement) => {
  const el = document.createElement('div')
  el.className = cls
  parent?.appendChild(el)
  return el
}

// フィナーレの時間割（ms）。最後は4秒より前に終わる
const T = { items: 150, stagger: 85, cheese: 450, count: 1350, tick: 380, frameGap: 400, end: 3850 }

const photo: Show = {
  id: 'finale:photo',
  cat: 'finale',
  name: 'きねんしゃしん',
  icon: '📷',
  base: true,
  maxMs: 5000,
  async play(ctx: ShowCtx) {
    const L = ctx.layer
    const words = (ctx.today ?? []).slice(-PHOTO_MAX)
    const slots = riserLayout(words.length)
    const char = getCurrent()?.char ?? 'monchan'

    const scene = div('photo-scene')
    scene.setAttribute('data-phase', 'dark')
    const dim = div('photo-dim', scene)
    const card = div('photo-card', scene)
    const pic = div('photo-pic', card)
    for (const cls of ['photo-step s1', 'photo-step s2', 'photo-step s3']) div(cls, pic) // ひな壇
    const items: HTMLElement[] = []
    // 奥のものから置く（手前が上に重なる）。おさるは いちばん手前
    words.forEach((q, i) => {
      const it = wordArt(q)
      placeItem(it, slots[i])
      pic.appendChild(it)
      items.push(it)
    })
    const mk = document.createElement('img')
    mk.className = 'photo-monkey pixel'
    mk.src = spriteUrl(char, 'happy')
    mk.alt = ''
    mk.draggable = false
    placeItem(mk, MONKEY_SLOT)
    pic.appendChild(mk)
    items.push(mk)
    const count = div('photo-count', card) // カメラのカウントは写真の上（暗いところ）に大きく
    const frame = div('photo-frame', card)
    frame.style.opacity = '0'
    const cap = div('photo-cap', frame)
    cap.textContent = fmtDay(dayKey(now()))
    div('photo-tape t1', frame)
    div('photo-tape t2', frame)
    const flashEl = div('photo-flash', scene)
    flashEl.style.opacity = '0'
    L.add(scene)

    // 1. 画面が暗くなる
    const dark = L.go(dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 350, fill: 'forwards' })
    // 2. ひな壇に ぽんぽんと並ぶ（おさるが最後）
    items.forEach((it, i) => {
      it.style.opacity = '0'
      void L.go(it, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.12)', offset: 0.65 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 320, delay: T.items + i * T.stagger, fill: 'forwards', easing: 'ease-out' }).then(() => {
        it.style.opacity = '1'
      })
    })
    await wait(T.cheese)
    scene.setAttribute('data-phase', 'arranged')
    // 3. 「はい、ちーず！」
    void ctx.speak('はい、ちーず！')
    await wait(T.count - T.cheese)
    // 4. 3・2・1
    scene.setAttribute('data-phase', 'count')
    for (const n of [3, 2, 1]) {
      count.textContent = String(n)
      if (ctx.motion <= 0) count.style.opacity = '1' // 動かさないときは そのまま見せる
      ctx.sfx.tick(false)
      void L.go(count, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.3 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.9)' }], { duration: T.tick })
      await wait(T.tick)
    }
    count.textContent = ''
    count.style.opacity = ''
    // フラッシュは1回だけ。ぱっと光って、ゆっくり消える（動きの強さ 0 のときは光らせない）
    scene.setAttribute('data-phase', 'flash')
    ctx.sfx.shutter()
    if (ctx.motion > 0) void L.go(flashEl, [{ opacity: 0 }, { opacity: 0.8, offset: 0.12 }, { opacity: 0 }], { duration: 1100, easing: 'ease-out' })
    await wait(T.frameGap)
    // 5. 写真の枠が ぺたっと貼られる
    scene.setAttribute('data-phase', 'framed')
    ctx.sfx.paste()
    frame.style.opacity = '1'
    await L.go(frame, [{ opacity: 0, transform: 'scale(1.35) rotate(-3deg)' }, { opacity: 1, transform: 'scale(.97) rotate(.5deg)', offset: 0.6 }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' })
    await dark
    await wait(Math.max(0, T.end - (T.count + 3 * T.tick + T.frameGap + 380)))
  },
}

export const FINALE_SHOWS: Show[] = [photo]
