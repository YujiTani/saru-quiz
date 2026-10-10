// バナナのやま: ためたバナナの合計で「もの」が大きくなる 7段階。段階の決め方・しきい値は lib/banana.ts
// 絵は 絵文字の上にバナナを山もりにしたもの（pileHtml）。タイトル・結果のカード・えんしゅつの再生で同じものを使う
import { BANANA_STAGES, bananaStage } from '../lib/banana'
import type { Show } from './types'

const INK = '#5b3a29'
// ねこぐるま（一輪車）。絵文字にないので SVG
const WHEELBARROW = `<svg viewBox="0 0 100 64" class="pile-base-svg" aria-hidden="true"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M18 36 L2 58 M30 40 L26 60 M44 40 L48 60" fill="none"/><path d="M12 12 H84 L70 42 H26 Z" fill="#e0a45a"/><path d="M72 14 L66 42 H26 L22 30 Z" fill="#c98b4b" opacity=".55" stroke="none"/><circle cx="84" cy="48" r="13" fill="#6b6b78"/><circle cx="84" cy="48" r="4" fill="#d8d8e0" stroke="none"/></g></svg>`

// ふね。🚢 は端末によって絵の右がきれてしまうので SVG
const SHIP = `<svg viewBox="0 0 100 64" class="pile-base-svg" aria-hidden="true"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><rect x="43" y="10" width="14" height="14" fill="#ffd400"/><path d="M43 17 H57" fill="none" stroke-width="3"/><rect x="26" y="22" width="48" height="18" rx="3" fill="#fff"/><circle cx="38" cy="31" r="3.5" fill="#8ecbff" stroke-width="2.5"/><circle cx="50" cy="31" r="3.5" fill="#8ecbff" stroke-width="2.5"/><circle cx="62" cy="31" r="3.5" fill="#8ecbff" stroke-width="2.5"/><path d="M4 40 H96 L84 58 H18 Z" fill="#e0505a"/><path d="M0 60 q8 -7 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t4 0" fill="none" stroke="#38b6ff" stroke-width="4"/></g></svg>`

type Spec = { base: string; /** 下の段から、段ごとのバナナの数 */ rows: number[]; /** バナナの山の いちばん下の段の高さ（0〜1） */ y: number; baseSize: number; ring?: boolean }
const SPECS: Spec[] = [
  { base: '', rows: [2, 1], y: 0.62, baseSize: 0 },
  { base: '🧺', rows: [3, 2], y: 0.56, baseSize: 0.66 },
  { base: WHEELBARROW, rows: [3, 2, 1], y: 0.52, baseSize: 0.78 },
  { base: '🚚', rows: [4, 3, 2], y: 0.5, baseSize: 0.62 },
  { base: SHIP, rows: [4, 3, 2, 1], y: 0.52, baseSize: 0.8 },
  { base: '🏝️', rows: [3, 2, 1], y: 0.5, baseSize: 0.7 },
  { base: '🌕', rows: [8], y: 0.5, baseSize: 0.52, ring: true },
]

/** 段階ごとの絵（HTML 文字列）。size は全体の一辺（px） */
export function pileHtml(stage: number, size: number): string {
  const s = Math.max(0, Math.min(SPECS.length - 1, stage))
  const sp = SPECS[s]
  const b = Math.round(size * 0.27) // バナナ1つの大きさ
  const parts: string[] = []
  if (sp.base) {
    parts.push(
      sp.base.startsWith('<svg')
        ? `<span class="pile-base" style="width:${Math.round(size * sp.baseSize)}px;bottom:${Math.round(size * 0.02)}px">${sp.base}</span>`
        : `<span class="pile-base" style="font-size:${Math.round(size * sp.baseSize)}px;bottom:${Math.round(size * 0.02)}px">${sp.base}</span>`,
    )
  }
  const at = (x: number, y: number, r: number) =>
    parts.push(`<span class="pile-b" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;font-size:${b}px;transform:translate(-50%,-50%) rotate(${r}deg)">🍌</span>`)
  if (sp.ring) {
    // バナナのほし: まるい星のまわりに バナナが ぐるっと並ぶ
    const n = sp.rows[0]
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      at(0.5 + 0.4 * Math.cos(a), 0.5 + 0.4 * Math.sin(a), (a * 180) / Math.PI + 90)
    }
    parts.push(`<span class="pile-spark" style="font-size:${Math.round(size * 0.2)}px;left:8%;top:6%">✨</span><span class="pile-spark" style="font-size:${Math.round(size * 0.16)}px;left:78%;top:10%">✨</span>`)
  } else {
    sp.rows.forEach((n, ri) => {
      const y = sp.y - ri * 0.17
      for (let i = 0; i < n; i++) {
        const x = 0.5 + (i - (n - 1) / 2) * 0.22
        at(x, y, (i % 2 ? 1 : -1) * (6 + ri * 3))
      }
    })
  }
  return `<div class="pile" style="width:${size}px;height:${size}px">${parts.join('')}</div>`
}

const banana = (i: number): Show => {
  const st = BANANA_STAGES[i]
  return {
    id: `banana:${st.id}`,
    cat: 'banana',
    name: st.name,
    icon: st.icon,
    ...(i === 0 ? { base: true } : { hint: `バナナを ${st.need} こ ためる`, unlock: (u) => bananaStage(u.coins) >= i }),
    // 「ためす」: 大きな絵をまんなかに ぽんと出す
    async play(ctx) {
      const el = document.createElement('div')
      el.className = 'pile-show'
      el.innerHTML = pileHtml(i, 200)
      ctx.layer.add(el, { x: innerWidth / 2, y: innerHeight * 0.4 })
      ctx.sfx.fanfare()
      await ctx.layer.go(el, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.12)', offset: 0.25 }, { opacity: 1, transform: 'scale(1)', offset: 0.8 }, { opacity: 0, transform: 'scale(1)' }], { duration: 1800 }, true)
    },
  }
}

export const BANANA_SHOWS: Show[] = BANANA_STAGES.map((_, i) => banana(i))
