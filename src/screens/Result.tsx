import { useEffect, useRef, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { burst, fountain, rain, shake } from '../lib/effects'
import { rankingEnabled, submitScore, type SubmitResult } from '../lib/ranking'
import { getPlayerName } from '../lib/settings'
import { sfx } from '../lib/sound'
import { speak } from '../lib/speech'
import type { QuizResult } from './Quiz'

// 0: けっかはっぴょうー！ 1: せいかい数 2: れんぞく 3: バナナ集計 4: おわり（ボタン表示）
type Stage = 0 | 1 | 2 | 3 | 4

type Props = { level: number; result: QuizResult; totalCoins: number; onAgain: () => void; onHome: () => void; onRanking: () => void }

export function Result({ level, result, totalCoins, onAgain, onHome, onRanking }: Props) {
  const [stage, setStage] = useState<Stage>(0)
  const [stars, setStars] = useState(0)
  const [shown, setShown] = useState(0)
  const [ask, setAsk] = useState(false)
  const [rank, setRank] = useState<SubmitResult | null>(null)
  const rankRef = useRef<SubmitResult | null>(null)
  const n = result.correct
  const perfect = n >= 5 && result.answers.every((a) => a.ok)

  // ランキングに送る（クリアしたらクリアタイム、しなかったら正解数。どちらもバナナ数つき）
  useEffect(() => {
    void submitScore({ course: level, cleared: result.cleared, clearMs: result.clearMs ?? null, correct: result.correct, bananas: result.coins }).then((r) => {
      rankRef.current = r
      setRank(r)
    })
  }, [level, result])

  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, f: () => void) => timers.push(setTimeout(() => alive && f(), ms))
    // ★は約1.6秒で数え終わるように（100問クリアでも長くならない）
    const per = Math.max(16, Math.min(160, 1600 / Math.max(n, 1)))
    const tickEvery = Math.max(1, Math.ceil(n / 30))

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
          if (i % tickEvery === 0) sfx.tick()
        })
      at(n * per + 200, () => {
        sfx.combo(2)
        burst(innerWidth / 2, innerHeight * 0.4, 'star', 30, 1.2)
        if (result.cleared && result.clearMs) {
          const sec = Math.floor(result.clearMs / 1000)
          const m = Math.floor(sec / 60)
          void speak([`${n}こ、せいかい！`, 'くりあたいむは', ...(m > 0 ? [`${m}ふん`] : []), `${sec % 60}びょう`, 'だよ'])
        } else void speak(n > 0 ? `${n}こ、せいかい！` : 'よくがんばったね！')
      })
    })

    const t2 = 1800 + per * n + (result.cleared ? 4200 : 1700)
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
        // 発表が終わってから少し間をおいて、きょうの順位 →「まだ あそぶ〜？」
        at(perfect ? 4200 : 2400, () => {
          setAsk(true)
          sfx.coin()
          const r = rankRef.current
          void speak(r && r.day <= 50 ? ['きょうの', `${r.day}い！`, 'まだ、あそぶー？'] : 'まだ、あそぶー？')
        })
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
      {stage >= 1 && result.cleared && result.clearMs !== undefined && (
        <div className="result-cleartime">
          <span>⏱ くりあたいむ</span>
          <span className="time">
            <b>{Math.floor(result.clearMs / 60000)}</b>ふん<b>{String(Math.floor(result.clearMs / 1000) % 60).padStart(2, '0')}</b>びょう
          </span>
        </div>
      )}
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
      {ask && (
        <div className="again-pop">
          <div className="again-card">
            <PixelMonkey char="monchan" mood="happy" size={72} anim="jump" />
            {rank ? (
              <p className="again-rank">
                🏆 きょうの <b>{rank.day}</b>い！ こんげつ <b>{rank.month}</b>い{rank.newBest && <span className="new-best">しんきろく！</span>}
              </p>
            ) : (
              rankingEnabled() && !getPlayerName() && <p className="again-note">せっていで なまえを いれると ランキングに のるよ</p>
            )}
            <p className="again-q">まだ、あそぶー？</p>
            <button className="btn again" onClick={() => { sfx.tap(); onAgain() }}>もういっかい！</button>
            <button className="btn home" onClick={() => { sfx.tap(); onHome() }}>おわり</button>
            <button className="btn rank-link" onClick={() => { sfx.tap(); onRanking() }}>🏆 らんきんぐを みる</button>
          </div>
        </div>
      )}
    </div>
  )
}
