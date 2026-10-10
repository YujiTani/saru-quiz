import { useEffect, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { fountain, rain } from '../lib/effects'
import { sfx } from '../lib/sound'
import { speak } from '../lib/speech'
import type { QuizResult } from './Quiz'

export function Result({ result, totalCoins, onAgain, onHome }: { result: QuizResult; totalCoins: number; onAgain: () => void; onHome: () => void }) {
  const [shown, setShown] = useState(0)
  const [done, setDone] = useState(false)
  const firstTry = result.answers.filter((a, i, arr) => a.ok && arr.findIndex((b) => b.id === a.id) === i).length
  const perfect = result.answers.length > 0 && result.answers.every((a) => a.ok)

  useEffect(() => {
    let alive = true
    sfx.drumroll(1.1)
    const start = setTimeout(() => {
      // コインをジャラジャラ数え上げる
      const steps = 24
      let i = 0
      const tick = setInterval(() => {
        if (!alive) return clearInterval(tick)
        i++
        setShown(Math.round((result.coins * i) / steps))
        if (i % 2) sfx.coin()
        if (i >= steps) {
          clearInterval(tick)
          setDone(true)
          sfx.fanfare()
          fountain('coin', 60)
          rain('confetti', 160)
          if (perfect) {
            rain('star', 120)
            rain('banana', 30)
            void speak('ぱーふぇくと！ ぜんぶ、せいかい！ すごーい！')
          } else void speak(`${firstTry}こ、せいかい！ よくできました！`)
        }
      }, 60)
    }, 1200)
    return () => {
      alive = false
      clearTimeout(start)
    }
  }, [result, firstTry, perfect])

  return (
    <div className="screen result">
      <h2 className={`result-title ${done ? 'pop' : ''} ${done && perfect ? 'perfect' : ''}`}>{done ? (perfect ? 'ぱーふぇくと！' : 'よくできました！') : 'けっか は…'}</h2>
      <div className="result-monkeys">
        <PixelMonkey char="mandrill" mood="happy" size={64} anim={done ? 'dance' : 'idle'} />
        <PixelMonkey char="monchan" mood="happy" size={110} anim={done ? 'jump' : 'idle'} />
        <PixelMonkey char="gorilla" mood="happy" size={72} anim={done ? 'dance' : 'idle'} />
      </div>
      <div className="result-stars">
        {Array.from({ length: result.answers.length ? new Set(result.answers.map((a) => a.id)).size : 0 }, (_, i) => (
          <span key={i} className={i < firstTry ? 'on' : ''} style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
            ★
          </span>
        ))}
      </div>
      <div className="result-coins">
        <span className="coin-big">🍌</span>
        <span className="num">+{shown}</span>
      </div>
      <div className="result-total">ぜんぶで 🍌 {totalCoins}</div>
      {result.bestCombo >= 3 && <div className="result-combo">さいこう {result.bestCombo} れんぞく！</div>}
      <div className={`result-actions ${done ? 'show' : ''}`}>
        <button className="btn again" onClick={() => { sfx.tap(); onAgain() }}>もういっかい！</button>
        <button className="btn home" onClick={() => { sfx.tap(); onHome() }}>おわり</button>
      </div>
    </div>
  )
}
