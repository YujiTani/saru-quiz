import { useEffect, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { burst, fountain, rain, shake } from '../lib/effects'
import { sfx } from '../lib/sound'
import { speak } from '../lib/speech'
import type { QuizResult } from './Quiz'

// 0: けっかはっぴょうー！ 1: せいかい数 2: れんぞく 3: バナナ集計 4: おわり（ボタン表示）
type Stage = 0 | 1 | 2 | 3 | 4

export function Result({ result, totalCoins, onAgain, onHome }: { result: QuizResult; totalCoins: number; onAgain: () => void; onHome: () => void }) {
  const [stage, setStage] = useState<Stage>(0)
  const [stars, setStars] = useState(0)
  const [shown, setShown] = useState(0)
  const n = result.correct
  const perfect = n >= 5 && result.answers.every((a) => a.ok)

  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, f: () => void) => timers.push(setTimeout(() => alive && f(), ms))
    const per = Math.max(60, Math.min(160, 1600 / Math.max(n, 1)))

    // けっかはっぴょうー！（ドラムロール）
    sfx.drumroll(1.6)
    void speak('けっかはっぴょうー！')

    // せいかい数: ★がポンポン増える
    at(1800, () => {
      setStage(1)
      sfx.jan()
      shake('small')
      for (let i = 1; i <= n; i++)
        at(i * per, () => {
          setStars(i)
          sfx.tick()
        })
      at(n * per + 200, () => {
        sfx.combo(2)
        burst(innerWidth / 2, innerHeight * 0.4, 'star', 30, 1.2)
        void speak(n > 0 ? `${n}こ、せいかい！` : 'よくがんばったね！')
      })
    })

    const t2 = 1800 + per * n + 1700
    // さいこう れんぞく
    at(t2, () => {
      setStage(2)
      if (result.bestCombo >= 2) {
        sfx.comboUp(result.bestCombo)
        burst(innerWidth / 2, innerHeight * 0.5, 'confetti', 40)
      }
    })

    // バナナ集計（ジャラジャラ）→ ファンファーレ
    at(t2 + 900, () => {
      setStage(3)
      const steps = 24
      for (let i = 1; i <= steps; i++)
        at(i * 50, () => {
          setShown(Math.round((result.coins * i) / steps))
          if (i % 2) sfx.coin()
        })
      at(steps * 50 + 300, () => {
        setStage(4)
        sfx.fanfare()
        fountain('coin', 70)
        rain('confetti', 180)
        if (perfect) {
          rain('star', 120)
          rain('banana', 30)
          void speak('ぱーふぇくと！ ぜんぶ、せいかい！ すごーい！')
        } else void speak('よくできました！')
      })
    })
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [result, n, perfect])

  return (
    <div className="screen result">
      {stage === 0 ? (
        <h2 className="result-announce">
          けっか
          <br />
          はっぴょうー！
        </h2>
      ) : (
        <h2 className={`result-title pop ${stage === 4 && perfect ? 'perfect' : ''}`}>{stage === 4 ? (perfect ? 'ぱーふぇくと！' : 'よくできました！') : 'けっか'}</h2>
      )}
      <div className="result-monkeys">
        <PixelMonkey char="mandrill" mood="happy" size={58} anim={stage >= 1 ? 'dance' : 'idle'} />
        <PixelMonkey char="monchan" mood="happy" size={100} anim={stage === 4 ? 'jump' : stage >= 1 ? 'dance' : 'idle'} />
        <PixelMonkey char="gorilla" mood="happy" size={66} anim={stage >= 1 ? 'dance' : 'idle'} />
      </div>
      {stage >= 1 && (
        <div className="result-count">
          <span>せいかい</span>
          <span className="num" key={stars}>
            {stars}
          </span>
          <span>もん！</span>
        </div>
      )}
      {stage >= 1 && (
        <div className="result-stars">
          {Array.from({ length: Math.min(stars, 30) }, (_, i) => (
            <span key={i} className="on">
              ★
            </span>
          ))}
        </div>
      )}
      {stage >= 2 && result.bestCombo >= 2 && <div className="result-combo pop">さいこう {result.bestCombo} れんぞく！</div>}
      {stage >= 3 && (
        <div className="result-coins">
          <span className="coin-big">🍌</span>
          <span className="num">+{shown}</span>
        </div>
      )}
      {stage >= 4 && <div className="result-total">ぜんぶで 🍌 {totalCoins}</div>}
      <div className={`result-actions ${stage === 4 ? 'show' : ''}`}>
        <button className="btn again" onClick={() => { sfx.tap(); onAgain() }}>もういっかい！</button>
        <button className="btn home" onClick={() => { sfx.tap(); onHome() }}>おわり</button>
      </div>
    </div>
  )
}
