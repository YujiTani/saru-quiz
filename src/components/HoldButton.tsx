// 長押しで開くボタン（子どもが誤って入らないようにする）。押している間、輪っかのゲージが回る
import { useEffect, useRef, useState } from 'react'

type Props = {
  /** 押しつづける時間（ミリ秒） */
  ms?: number
  onHold: () => void
  className?: string
  label: string
  children: React.ReactNode
}

const R = 20
const C = 2 * Math.PI * R

export function HoldButton({ ms = 2000, onHold, className = '', label, children }: Props) {
  const [p, setP] = useState(0) // 0〜1
  const raf = useRef(0)
  const hold = useRef(onHold)
  hold.current = onHold

  const stop = () => {
    cancelAnimationFrame(raf.current)
    setP(0)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  function down(e: React.PointerEvent) {
    if (e.button > 0) return
    const t0 = performance.now()
    cancelAnimationFrame(raf.current)
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / ms)
      setP(t)
      if (t >= 1) return hold.current() // 開く（指を離すまで輪っかは満タンのまま）
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  return (
    <button
      className={`hold-btn ${className} ${p > 0 ? 'is-holding' : ''}`}
      aria-label={label}
      data-progress={p.toFixed(2)}
      onPointerDown={down}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="hold-ring" viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r={R} className="hold-track" />
        <circle cx="24" cy="24" r={R} className="hold-arc" strokeDasharray={C} strokeDashoffset={C * (1 - p)} />
      </svg>
      <span className="hold-icon" aria-hidden>
        🔑
      </span>
      <span className="hold-text">{children}</span>
    </button>
  )
}
