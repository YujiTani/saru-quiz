// 全画面パーティクル（紙吹雪・コイン・星・バナナ）
type Kind = 'confetti' | 'coin' | 'star' | 'banana'
type P = { kind: Kind; x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; life: number; max: number }

const COLORS = ['#ff4f9a', '#ffd400', '#3ee07a', '#38b6ff', '#a066ff', '#ff8a1c']
let ctx: CanvasRenderingContext2D | null = null
let parts: P[] = []
let running = false
let dpr = 1

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

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function spawn(kind: Kind, x: number, y: number, vx: number, vy: number) {
  const size = kind === 'confetti' ? rand(6, 12) : kind === 'coin' ? rand(14, 22) : kind === 'banana' ? rand(24, 36) : rand(10, 18)
  parts.push({ kind, x, y, vx, vy, rot: rand(0, 6.28), vr: rand(-0.3, 0.3), size, color: COLORS[(Math.random() * COLORS.length) | 0], life: 0, max: rand(70, 120) })
}

/** (x,y) から放射状にはじける */
export function burst(x: number, y: number, kind: Kind, count: number, power = 1) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2)
    const s = rand(4, 12) * power
    spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s - rand(3, 8))
  }
  start()
}

/** 画面上から降らせる */
export function rain(kind: Kind, count: number) {
  for (let i = 0; i < count; i++) spawn(kind, rand(0, innerWidth), rand(-200, -10), rand(-1, 1), rand(1, 4))
  start()
}

/** 下から噴水のように吹き上げる */
export function fountain(kind: Kind, count: number) {
  for (let i = 0; i < count; i++) spawn(kind, innerWidth / 2 + rand(-40, 40), innerHeight + 20, rand(-7, 7), rand(-22, -14))
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
    parts = parts.filter((p) => p.life < p.max && p.y < innerHeight + 80)
    for (const p of parts) {
      p.life++
      p.vy += p.kind === 'confetti' ? 0.18 : 0.45
      p.vx *= p.kind === 'confetti' ? 0.97 : 0.99
      p.x += p.vx + (p.kind === 'confetti' ? Math.sin(p.life * 0.15) * 0.8 : 0)
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

/** 画面ゆれ（ドパッと感） */
export function shake(strength: 'small' | 'big' = 'small') {
  const root = document.getElementById('root')
  if (!root) return
  root.classList.remove('shake-small', 'shake-big')
  void root.offsetWidth
  root.classList.add(`shake-${strength}`)
}

/** 白フラッシュ。光過敏に配慮して1回だけ・ゆっくり消える */
export function flash() {
  const el = document.getElementById('flash')
  if (!el) return
  el.classList.remove('on')
  void el.offsetWidth
  el.classList.add('on')
}

