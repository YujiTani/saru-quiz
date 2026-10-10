// 画面全体に重ねる DOM の層。演出の「動く絵」を置く場所（canvas の粒子より下）
// アニメは Web Animations API。終わったら要素を消す。動きの強さ 0 のときは「ふわっと出て消えるだけ」にする
export type Pt = { x: number; y: number }

export type ShowLayer = {
  /** 要素を置く。at があればその点が要素の中心 */
  add(el: HTMLElement, at?: Pt): HTMLElement
  /** src と同じ位置・大きさに複製を置く */
  cloneOf(src: Element): HTMLElement
  /** 絵文字を (x,y) を中心に置く */
  emoji(char: string, x: number, y: number, size: number): HTMLElement
  /** アニメを再生して、終わったら（remove なら要素も消して）resolve。motion が 0 なら最小の動きにかわる */
  go(el: Element, keyframes: Keyframe[], opts: KeyframeAnimationOptions, remove?: boolean): Promise<void>
  /** clear() のときに呼ぶ後始末を登録する */
  defer(fn: () => void): void
  /** 置いたものと、動いているアニメをすべて片づける（再生中の演出は、あとから何も置けなくなる） */
  clear(): void
  /** 動きの強さ（makeCtx が入れる） */
  motion: number
}

let root: HTMLElement | null = null
let anims: Animation[] = []
let cleanups: (() => void)[] = []
// clear() のたびに増える。古い演出がそのあとに要素を置いたり動かしたりしないための印
let gen = 0

/** App の <div id="show-layer"> とつなぐ */
export function attachLayer(el: HTMLElement) {
  root = el
}

const place = (el: HTMLElement, left: number, top: number) => {
  el.style.position = 'absolute'
  el.style.left = `${left}px`
  el.style.top = `${top}px`
}

function clearAll() {
  gen++
  for (const a of anims) {
    try {
      a.cancel()
    } catch {
      // すでに終わっている
    }
  }
  anims = []
  const fns = cleanups
  cleanups = []
  for (const f of fns) f()
  if (root) root.replaceChildren()
}

/**
 * 層の道具を作る。scoped なら、作った時点のあとに clear() されると古い扱いになり、
 * 何も置かない・動かさない（まだ動いている演出が次の問題に入りこまないように）
 */
export function makeLayer(scoped = true): ShowLayer {
  const my = gen
  const stale = () => scoped && my !== gen
  const self: ShowLayer = {
    motion: 1,

    add(el, at) {
      if (!root || stale()) return el
      el.style.position = 'absolute' // 先に absolute にして、中身の幅で大きさを測る
      root.appendChild(el)
      if (at) {
        // 画面の外にはみださないようにする
        const x = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, at.x - el.offsetWidth / 2))
        place(el, x, at.y - el.offsetHeight / 2)
      }
      return el
    },

    cloneOf(src) {
      const r = src.getBoundingClientRect()
      const cs = getComputedStyle(src)
      const c = src.cloneNode(true) as HTMLElement
      c.removeAttribute('id')
      c.classList.add('show-clone')
      place(c, r.left, r.top)
      Object.assign(c.style, { width: `${r.width}px`, height: `${r.height}px`, margin: '0', animation: 'none', transform: 'none', opacity: '1', padding: cs.padding, objectFit: 'contain', fontSize: cs.fontSize, lineHeight: cs.lineHeight, display: src instanceof HTMLImageElement ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center' })
      if (root && !stale()) root.appendChild(c)
      return c
    },

    emoji(char, x, y, size) {
      const el = document.createElement('div')
      el.className = 'show-emoji'
      el.textContent = char
      Object.assign(el.style, { width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.85}px`, lineHeight: `${size}px` })
      place(el, x - size / 2, y - size / 2)
      if (root && !stale()) root.appendChild(el)
      return el
    },

    go(el, keyframes, opts, remove = false) {
      if (stale()) return Promise.resolve()
      const mine = el.parentElement === root
      let kf = keyframes
      let o = opts
      if (self.motion <= 0) {
        if (!mine) return new Promise((r) => setTimeout(r, Math.min(Number(opts.duration) || 0, 600))) // 自分のものでない要素は動かさない
        // 最小: その場でふわっと出て、消える（光るだけ）
        kf = [
          { opacity: 0, filter: 'drop-shadow(0 0 0 #ffd400)' },
          { opacity: 1, filter: 'drop-shadow(0 0 14px #ffd400)', offset: 0.4 },
          { opacity: 0, filter: 'drop-shadow(0 0 0 #ffd400)' },
        ]
        o = { duration: Math.min(Number(opts.duration) || 600, 700), easing: 'ease-in-out' }
        remove = true
      }
      const a = el.animate(kf, o)
      anims.push(a)
      return a.finished.then(
        () => {
          if (remove && mine) el.remove()
        },
        () => {}, // cancel されたとき
      )
    },

    defer(fn) {
      if (stale()) return void fn()
      cleanups.push(fn)
    },

    clear: clearAll,
  }
  return self
}

/** 画面全体で1つの層（attach・clear に使う） */
export const layer: ShowLayer = makeLayer(false)
