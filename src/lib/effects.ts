// 全画面パーティクル（紙吹雪・コイン・星・バナナ・羽根・泡・音符・花びら・雨・雪・絵）
import { rng } from './rng'

export type Kind = 'confetti' | 'coin' | 'star' | 'banana' | 'feather' | 'bubble' | 'note' | 'petal' | 'raindrop' | 'snow' | 'illust'
type P = { kind: Kind; x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; life: number; max: number; phase: number; img?: HTMLImageElement }

const COLORS = ['#ff4f9a', '#ffd400', '#3ee07a', '#38b6ff', '#a066ff', '#ff8a1c']
const FEATHER_COLORS = ['#ffffff', '#ffe27a', '#ffb3d1', '#9fd8ff']
const PETAL_COLORS = ['#ffb3d1', '#ff8fb8', '#ffd1e3']
/** 粒子の数の上限。あふれたら古いものから消す */
export const MAX_PARTICLES = 400

// 種類ごとの動き。g: 重力（マイナスは浮かぶ）, drag: 空気抵抗, sway/freq: 左右のゆれ, maxVy: 落ちる速さの上限, soft: はじけ方をおだやかに
type Phys = { g: number; drag: number; sway: number; freq: number; maxVy?: number; soft?: boolean }
const HEAVY: Phys = { g: 0.45, drag: 0.99, sway: 0, freq: 0.15 }
const PHYS: Record<Kind, Phys> = {
  confetti: { g: 0.18, drag: 0.97, sway: 0.8, freq: 0.15 },
  coin: HEAVY,
  star: HEAVY,
  banana: HEAVY,
  illust: HEAVY,
  feather: { g: 0.04, drag: 0.96, sway: 1.6, freq: 0.08, maxVy: 2.2, soft: true },
  bubble: { g: -0.03, drag: 0.97, sway: 0.6, freq: 0.1, maxVy: 3, soft: true },
  note: { g: -0.02, drag: 0.97, sway: 0.9, freq: 0.12, maxVy: 3, soft: true },
  petal: { g: 0.03, drag: 0.96, sway: 1.4, freq: 0.07, maxVy: 2, soft: true },
  raindrop: { g: 0.5, drag: 1, sway: 0, freq: 0.1, maxVy: 16 },
  snow: { g: 0.02, drag: 0.97, sway: 0.8, freq: 0.06, maxVy: 1.6, soft: true },
}

let ctx: CanvasRenderingContext2D | null = null
let parts: P[] = []
let running = false
let dpr = 1
let motion = 1

export function attachEffects(el: HTMLCanvasElement) {
  ctx = el.getContext('2d')
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = innerWidth * dpr
    el.height = innerHeight * dpr
  }
  resize()
  addEventListener('resize', resize)
}

/** 動きの強さ 0〜1（設定画面）。粒子の数・ゆれ・フラッシュに効く */
export function setMotion(m: number) {
  motion = Math.max(0, Math.min(1, m))
}
export const getMotion = () => motion

/** 動きの強さをかけた粒子の数。0 のときは最大4個 */
export function scaled(count: number): number {
  if (count <= 0) return 0
  if (motion <= 0) return Math.min(4, Math.max(1, Math.round(count * 0.15)))
  return Math.max(1, Math.round(count * (0.15 + 0.85 * motion)))
}

const rand = (a: number, b: number) => a + rng() * (b - a)

// 絵（SVG）は一度読んだら使い回す
const imgCache = new Map<string, HTMLImageElement>()
function loadImg(src: string): HTMLImageElement {
  let img = imgCache.get(src)
  if (!img) {
    img = new Image(128, 128) // 大きさを決めておく（SVG に width/height がなくても描けるように）
    img.src = src
    imgCache.set(src, img)
  }
  return img
}

const SIZES: Record<Kind, [number, number]> = {
  confetti: [6, 12],
  coin: [14, 22],
  star: [10, 18],
  banana: [24, 36],
  feather: [18, 28],
  bubble: [10, 26],
  note: [18, 28],
  petal: [10, 16],
  raindrop: [10, 16],
  snow: [4, 8],
  illust: [30, 46],
}

function spawn(kind: Kind, x: number, y: number, vx: number, vy: number, img?: HTMLImageElement) {
  const [a, b] = SIZES[kind]
  const long = PHYS[kind].soft ? [110, 170] : [70, 120]
  const color = kind === 'feather' ? FEATHER_COLORS[(rng() * FEATHER_COLORS.length) | 0] : kind === 'petal' ? PETAL_COLORS[(rng() * PETAL_COLORS.length) | 0] : COLORS[(rng() * COLORS.length) | 0]
  parts.push({ kind, x, y, vx, vy, rot: rand(0, 6.28), vr: kind === 'raindrop' ? 0 : rand(-0.3, 0.3) * (PHYS[kind].soft ? 0.4 : 1), size: rand(a, b), color, life: 0, max: rand(long[0], long[1]), phase: rand(0, 6.28), img })
  // 上限をこえたら古いものから消す
  if (parts.length > MAX_PARTICLES) parts.splice(0, parts.length - MAX_PARTICLES)
}

/** (x,y) から放射状にはじける */
export function burst(x: number, y: number, kind: Kind, count: number, power = 1) {
  const soft = PHYS[kind].soft ? 0.45 : 1
  for (let i = 0; i < scaled(count); i++) {
    const a = rand(0, Math.PI * 2)
    const s = rand(4, 12) * power * soft
    spawn(kind, x, y, Math.cos(a) * s, (Math.sin(a) * s - rand(3, 8) * soft))
  }
  start()
}

/** 単語の絵（SVG）をはじけさせる */
export function burstIllust(src: string, x: number, y: number, n: number) {
  const img = loadImg(src)
  for (let i = 0; i < scaled(n); i++) {
    const a = rand(0, Math.PI * 2)
    const s = rand(4, 11)
    spawn('illust', x, y, Math.cos(a) * s, Math.sin(a) * s - rand(3, 8), img)
  }
  start()
}

/** (x,y) のまわりからふわっと出す（羽根・泡・音符など。spread は横のばらつき） */
export function drift(kind: Kind, x: number, y: number, count: number, spread = 30) {
  for (let i = 0; i < scaled(count); i++) {
    spawn(kind, x + rand(-spread, spread), y + rand(-spread / 2, spread / 2), rand(-1.2, 1.2), PHYS[kind].g < 0 ? rand(-2.5, -0.8) : rand(-0.5, 0.8))
  }
  start()
}

/** 画面上から降らせる */
export function rain(kind: Kind, count: number) {
  for (let i = 0; i < scaled(count); i++) spawn(kind, rand(0, innerWidth), rand(-200, -10), rand(-1, 1), rand(1, 4))
  start()
}

/** 下から噴水のように吹き上げる */
export function fountain(kind: Kind, count: number) {
  for (let i = 0; i < scaled(count); i++) spawn(kind, innerWidth / 2 + rand(-40, 40), innerHeight + 20, rand(-7, 7), rand(-22, -14))
  start()
}

function draw(p: P, g: CanvasRenderingContext2D) {
  g.save()
  g.translate(p.x, p.y)
  g.rotate(p.rot)
  g.globalAlpha = Math.min(1, (p.max - p.life) / 20)
  if (p.kind === 'confetti') {
    g.fillStyle = p.color
    g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
  } else if (p.kind === 'coin') {
    const w = Math.abs(Math.cos(p.life * 0.2)) * p.size // くるくる回る
    g.fillStyle = '#ffcc00'
    g.beginPath()
    g.ellipse(0, 0, w / 2 + 1, p.size / 2, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff3a0'
    g.fillRect(-w / 6, -p.size / 4, Math.max(1, w / 6), p.size / 2)
    g.strokeStyle = '#b8860b'
    g.lineWidth = 2
    g.stroke()
  } else if (p.kind === 'star') {
    g.fillStyle = p.color
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? p.size / 2.4 : p.size
      g.lineTo(Math.cos((i * Math.PI) / 5) * r, Math.sin((i * Math.PI) / 5) * r)
    }
    g.fill()
  } else if (p.kind === 'feather') {
    // 先のとがった細長い羽根と、まんなかの軸
    const w = p.size * 0.28
    g.fillStyle = p.color
    g.strokeStyle = '#b79a7a'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(0, -p.size / 2)
    g.quadraticCurveTo(w * 1.6, 0, 0, p.size / 2)
    g.quadraticCurveTo(-w * 1.6, 0, 0, -p.size / 2)
    g.fill()
    g.stroke()
    g.beginPath()
    g.moveTo(0, -p.size / 2)
    g.lineTo(0, p.size / 2 + 4)
    g.stroke()
  } else if (p.kind === 'bubble') {
    // 半透明の泡（ふちと光る点）
    g.globalAlpha *= 0.6
    g.fillStyle = 'rgba(200, 235, 255, 0.35)'
    g.strokeStyle = '#7cc6f0'
    g.lineWidth = 2
    g.beginPath()
    g.arc(0, 0, p.size / 2, 0, Math.PI * 2)
    g.fill()
    g.stroke()
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(-p.size / 6, -p.size / 6, Math.max(1.5, p.size / 8), 0, Math.PI * 2)
    g.fill()
  } else if (p.kind === 'note') {
    g.fillStyle = p.color
    g.font = `${p.size * 1.4}px sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(p.phase > 3.14 ? '♪' : '♫', 0, 0)
  } else if (p.kind === 'petal') {
    const w = Math.abs(Math.cos(p.life * 0.08 + p.phase)) * p.size * 0.5 + 2 // ひらひら裏返る
    g.fillStyle = p.color
    g.beginPath()
    g.ellipse(0, 0, w, p.size / 2, 0, 0, Math.PI * 2)
    g.fill()
  } else if (p.kind === 'raindrop') {
    g.rotate(-p.rot + 0.12)
    g.strokeStyle = '#6fb8f0'
    g.lineWidth = 2.5
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(0, -p.size / 2)
    g.lineTo(0, p.size / 2)
    g.stroke()
  } else if (p.kind === 'snow') {
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(0, 0, p.size / 2, 0, Math.PI * 2)
    g.fill()
  } else if (p.kind === 'illust') {
    const img = p.img
    if (img && img.complete && img.naturalWidth > 0) g.drawImage(img, -p.size, -p.size, p.size * 2, p.size * 2)
  } else {
    g.font = `${p.size}px sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('🍌', 0, 0)
  }
  g.restore()
}

function start() {
  if (running || !ctx) return
  running = true
  const loop = () => {
    const g = ctx!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, innerWidth, innerHeight)
    parts = parts.filter((p) => p.life < p.max && p.y < innerHeight + 80 && p.y > -300)
    for (const p of parts) {
      p.life++
      const ph = PHYS[p.kind]
      p.vy += ph.g
      if (ph.maxVy !== undefined) p.vy = Math.max(-ph.maxVy, Math.min(ph.maxVy, p.vy))
      p.vx *= ph.drag
      p.x += p.vx + (ph.sway ? Math.sin(p.life * ph.freq + p.phase) * ph.sway : 0)
      p.y += p.vy
      p.rot += p.vr
      draw(p, g)
    }
    if (parts.length) requestAnimationFrame(loop)
    else {
      g.clearRect(0, 0, innerWidth, innerHeight)
      running = false
    }
  }
  requestAnimationFrame(loop)
}

/** 画面ゆれ（ドパッと感）。動きの強さが低いときは何もしない */
export function shake(strength: 'small' | 'big' = 'small') {
  if (motion < 0.3) return
  const root = document.getElementById('root')
  if (!root) return
  root.classList.remove('shake-small', 'shake-big')
  void root.offsetWidth
  root.classList.add(`shake-${strength}`)
}

/** 白フラッシュ。光過敏に配慮して1回だけ・ゆっくり消える。動きの強さ0のときは何もしない */
export function flash() {
  if (motion <= 0) return
  const el = document.getElementById('flash')
  if (!el) return
  el.classList.remove('on')
  void el.offsetWidth
  el.classList.add('on')
}
