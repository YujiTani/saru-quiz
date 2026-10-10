// みちのり: クイズ画面の上の、横長の道。せいかい数に合わせて おさるが ゴールのバナナの木へ歩く
// 空は E（せいかい数 ÷ クリアの数）で 朝 → 昼 → 夕焼け → 夜。1/3 に川と橋、2/3 にどうくつ
// 動きの強さ 0 のときは、跳ねない・すべらない（位置だけ変える）・ホタルと流れ星と泡は出さない
import { useEffect, useRef, useState } from 'react'
import { LANDMARKS, crossed, roadX, skyStage, type MichiTheme, type SkyStage } from '../shows/michi'
import type { CharId } from '../sprites/monkeys'
import { PixelMonkey } from './PixelMonkey'

const STAGES: SkyStage[] = ['morning', 'day', 'evening', 'night']

/** テーマごとの、道ばたの かざり（x は左からの %） */
const DECOR: Record<MichiTheme, { c: string; x: number; s: number; sky?: boolean }[]> = {
  jungle: [
    { c: '🌿', x: 18, s: 15 },
    { c: '🌴', x: 44, s: 17 },
    { c: '🌿', x: 63, s: 14 },
    { c: '🌺', x: 76, s: 13 },
  ],
  umi: [
    { c: '🌿', x: 17, s: 16 },
    { c: '🪸', x: 45, s: 15 },
    { c: '🌿', x: 66, s: 16 },
    { c: '🐠', x: 28, s: 14, sky: true },
    { c: '🐟', x: 58, s: 13, sky: true },
  ],
  okashi: [
    { c: '🍩', x: 17, s: 15 },
    { c: '🍬', x: 45, s: 14 },
    { c: '🍭', x: 65, s: 16 },
    { c: '🧁', x: 77, s: 14 },
  ],
  uchu: [
    { c: '🪐', x: 26, s: 16, sky: true },
    { c: '🌕', x: 60, s: 13, sky: true },
    { c: '⭐', x: 76, s: 11, sky: true },
  ],
}
const GOAL: Record<MichiTheme, string> = { jungle: '🌴', umi: '🪸', okashi: '🧁', uchu: '🛸' }

export function Road({ correct, goal, theme, char, motion }: { correct: number; goal: number; theme: MichiTheme; char: CharId; motion: number }) {
  const p = goal > 0 ? Math.min(1, correct / goal) : 0
  const stage = skyStage(p)
  const move = motion > 0
  const prev = useRef({ p, n: correct })
  const [hop, setHop] = useState(0)
  const [bridge, setBridge] = useState(0)
  const [cave, setCave] = useState(0)

  // 1マス進んだら ぴょん。橋・どうくつを通りすぎたら、ゆれる・やっほー
  useEffect(() => {
    const pv = prev.current
    prev.current = { p, n: correct }
    if (correct > pv.n) setHop((h) => h + 1)
    if (crossed(pv.p, p, LANDMARKS.bridge)) setBridge((k) => k + 1)
    if (crossed(pv.p, p, LANDMARKS.cave)) setCave((k) => k + 1)
  }, [p, correct])

  const night = stage === 'night'
  return (
    <div className={`road th-${theme} sky-${stage} ${move ? '' : 'still'}`} aria-hidden>
      {STAGES.map((s) => (
        <div key={s} className={`road-sky s-${s} ${s === stage ? 'on' : ''}`} />
      ))}
      <div className={`road-stars ${night || theme === 'uchu' ? 'on' : ''}`} />
      <div className={`road-sun ${stage}`} style={{ left: `${10 + p * 55}%` }} />
      {DECOR[theme].map((d, i) => (
        <span key={i} className={`road-decor ${d.sky ? 'in-sky' : ''}`} style={{ left: `${d.x}%`, fontSize: d.s }}>
          {d.c}
        </span>
      ))}
      {theme === 'umi' && [0, 1, 2].map((i) => <span key={i} className="road-bubble" style={{ left: `${22 + i * 27}%`, animationDelay: `${i * 0.9}s` }} />)}
      <div className="road-ground" />
      <span className="road-start">🚩</span>
      {/* 川と橋 */}
      <div className="road-river" style={{ left: `${roadX(LANDMARKS.bridge)}%` }} />
      <div key={`b${bridge}`} className={`road-bridge ${bridge > 0 && move ? 'swing' : ''}`} style={{ left: `${roadX(LANDMARKS.bridge)}%` }} />
      {/* どうくつ */}
      <div className="road-cave" style={{ left: `${roadX(LANDMARKS.cave)}%` }} />
      {cave > 0 && (
        <div key={`c${cave}`} className={`road-echo ${move ? '' : 'still'}`} style={{ left: `${roadX(LANDMARKS.cave)}%` }}>
          <span className="e1">やっほー</span>
          <span className="e2">やっほー</span>
        </div>
      )}
      {/* ゴール: 大きなバナナの木 */}
      <div className="road-goal">
        <span className="goal-tree">{GOAL[theme]}</span>
        <span className="goal-banana">🍌</span>
      </div>
      {night && move && (
        <>
          <span className="road-firefly f1" />
          <span className="road-firefly f2" />
          <span className="road-firefly f3" />
          <span className="road-firefly f4" />
          <span className="road-meteor" />
        </>
      )}
      <div className="road-char" style={{ left: `${roadX(p)}%` }}>
        <div key={hop} className={hop > 0 && move ? 'road-hop' : ''}>
          <PixelMonkey char={char} mood={p >= 1 ? 'happy' : 'normal'} size={25} anim="none" />
        </div>
      </div>
    </div>
  )
}
