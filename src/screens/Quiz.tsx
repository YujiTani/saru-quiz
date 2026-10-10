import { useEffect, useRef, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { burst, fountain, rain, shake, flash } from '../lib/effects'
import { makeRound, type Question, type Round } from '../lib/quiz'
import { sfx } from '../lib/sound'
import { preloadSpeech, speak, stopSpeaking } from '../lib/speech'
import type { CharId, Mood } from '../sprites/monkeys'

export type QuizResult = { correct: number; total: number; coins: number; bestCombo: number; answers: { id: string; ok: boolean }[] }

type Phase = 'reading' | 'answering' | 'correct' | 'wrong' | 'end'
type Banner = { text: string; key: number; kind: 'combo' | 'fever' | 'legend' | 'bonus' | 'end' }

const PRAISE = ['せいかい！', 'すごーい！', 'やったね！', 'あたり！', 'てんさい！']
const PEEKERS: CharId[] = ['mandrill', 'orangutan', 'kinshikou', 'gorilla', 'rainbow']
const DANCERS: CharId[] = ['mandrill', 'orangutan', 'monchan', 'gorilla', 'kinshikou', 'rainbow']
// 時間ゲージ。出題中（読み上げ・回答中）だけ減り、正解すると少し回復する
// テスト用に ?time=秒 で短くできる
const TIME_MAX = (Number(new URLSearchParams(location.search).get('time')) || 15) * 1000
const TIME_BONUS = 3_000 // 正解で +3秒
const TIME_PENALTY = 3_000 // まちがいで -3秒
const TICK = 100

export function Quiz({ level, questions, onFinish, onQuit }: { level: number; questions: Question[]; onFinish: (r: QuizResult) => void; onQuit: () => void }) {
  const queueRef = useRef(questions)
  const [index, setIndex] = useState(0)
  const [round, setRound] = useState<Round>(() => makeRound(questions[0], level))
  const [phase, setPhase] = useState<Phase>('reading')
  const phaseRef = useRef<Phase>('reading')
  phaseRef.current = phase
  const [reading, setReading] = useState(-1)
  const [picked, setPicked] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [combo, setCombo] = useState(0)
  const [coins, setCoins] = useState(0)
  const coinsRef = useRef(0)
  coinsRef.current = coins
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [fever, setFever] = useState(false)
  const [helper, setHelper] = useState<CharId | null>(null)
  const [bubble, setBubble] = useState('これ なあに？')
  const [peeker, setPeeker] = useState<{ char: CharId; key: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIME_MAX)
  const timeRef = useRef(TIME_MAX)
  const [timeGain, setTimeGain] = useState<{ key: number; plus: boolean } | null>(null)
  // ときどき「ボーナス問題」（金色・バナナ3ばい）。最初の2問は普通
  const [isBonus, setIsBonus] = useState(false)
  const stats = useRef({ correct: 0, bestCombo: 0, answers: [] as { id: string; ok: boolean }[] })
  const token = useRef(0) // 読み上げ途中で次へ進んだとき、古い非同期処理を止める

  // 問題が変わったら「じゃじゃーん」→「これなあに？」→ 選択肢を順番に読み上げ
  useEffect(() => {
    const my = ++token.current
    setPhase('reading')
    setPicked(null)
    setSelected(null)
    setBubble('これ なあに？')
    preloadSpeech(round.choices)
    const bonus = index >= 2 && Math.random() < 0.15
    setIsBonus(bonus)
    sfx.whoosh()
    if (bonus) {
      setBanner({ text: 'ぼーなす！', kind: 'bonus', key: Date.now() })
      setTimeout(() => setBanner(null), 1500)
      sfx.bonus()
      rain('star', 40)
    } else sfx.jajan()
    ;(async () => {
      if (bonus) await speak('ぼーなす！')
      await wait(250)
      await speak('これ、なあに？')
      for (let i = 0; i < round.choices.length; i++) {
        if (token.current !== my) return
        setReading(i)
        await speak(round.choices[i])
        await wait(120)
      }
      if (token.current !== my) return
      setReading(-1)
      setPhase('answering')
    })()
    return () => stopSpeaking()
  }, [round, index])

  // 時間ゲージ
  useEffect(() => {
    const id = setInterval(() => {
      const p = phaseRef.current
      if (p !== 'reading' && p !== 'answering') return
      const t = Math.max(0, timeRef.current - TICK)
      if (t <= 10_000 && t % 1000 === 0 && t > 0) sfx.tick(t <= 5_000)
      timeRef.current = t
      setTimeLeft(t)
      if (t === 0) endGame()
    }, TICK)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      document.body.classList.remove('fever')
      sfx.stopFever()
    },
    [],
  )
  useEffect(() => {
    document.body.classList.toggle('fever', fever)
    if (fever) sfx.startFever()
    else sfx.stopFever()
  }, [fever])

  function center(el: Element) {
    const r = el.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2] as const
  }

  // 3歳児はひらがなが読めないので、1回目のタップは「選ぶ＋読み上げ」、
  // 同じボタンをもう一度 or「これ！」ボタンで回答する
  function select(i: number) {
    if (phase !== 'reading' && phase !== 'answering') return
    const el = choiceRefs.current[i]
    if (selected === i && el) return answer(round.choices[i], el)
    token.current++
    stopSpeaking()
    setReading(-1)
    setSelected(i)
    setPhase('answering')
    setBubble('これかな？')
    sfx.select()
    void speak(round.choices[i])
  }

  function decide() {
    if (selected === null) return
    const el = choiceRefs.current[selected]
    if (el) answer(round.choices[selected], el)
  }

  function answer(choice: string, el: HTMLElement) {
    if (phase !== 'reading' && phase !== 'answering') return
    token.current++
    stopSpeaking()
    setReading(-1)
    setPicked(choice)
    const q = round.q
    const [x, y] = center(el)

    if (choice === q.a) {
      const c = combo + 1
      const add = 10 * (1 + Math.floor(c / 3)) * (isBonus ? 3 : 1) * (fever ? 2 : 1)
      setCombo(c)
      setCoins((v) => v + add)
      setGain({ n: add, key: Date.now() })
      timeRef.current = Math.min(TIME_MAX, timeRef.current + TIME_BONUS)
      setTimeLeft(timeRef.current)
      setTimeGain({ key: Date.now(), plus: true })
      stats.current.correct++
      stats.current.bestCombo = Math.max(stats.current.bestCombo, c)
      stats.current.answers.push({ id: q.id, ok: true })
      setPhase('correct')
      let shout = PRAISE[(Math.random() * PRAISE.length) | 0]
      setBubble(shout)

      sfx.correct(c)
      sfx.coinCascade(Math.min(4 + c, 14))
      if (c >= 2) sfx.comboUp(c)
      flash()
      burst(x, y, 'confetti', 60)
      burst(x, y, 'coin', 8 + Math.min(c, 10) * 2, 0.9)
      if (c === 3) shout = celebrate('すごい！', 'combo', 'mandrill', x, y)
      if (c === 5) {
        shout = celebrate('ふぃーばー！', 'fever', 'gorilla', x, y)
        setFever(true)
      }
      if (c === 8 || (c > 8 && c % 5 === 3)) shout = celebrate('でんせつ！', 'legend', 'rainbow', x, y)
      if (fever) rain('banana', 8)
      if (isBonus) {
        fountain('coin', 50)
        sfx.bonus()
      }
      // ときどき別のおさるが顔を出してよろこぶ
      if (c !== 3 && c !== 5 && c !== 8 && Math.random() < 0.6) {
        setPeeker({ char: PEEKERS[(Math.random() * PEEKERS.length) | 0], key: Date.now() })
        setTimeout(() => setPeeker(null), 1800)
      }

      ;(async () => {
        await speak([shout, q.a])
        await wait(350)
        next()
      })()
    } else {
      setCombo(0)
      setFever(false)
      timeRef.current = Math.max(0, timeRef.current - TIME_PENALTY)
      setTimeLeft(timeRef.current)
      setTimeGain({ key: Date.now(), plus: false })
      stats.current.answers.push({ id: q.id, ok: false })
      setPhase('wrong')
      setBubble('おしい！')
      sfx.wrong()
      sfx.boing()
      shake('small')
      // まちがえた問題はあとでもう一度
      const qs = queueRef.current
      queueRef.current = [...qs.slice(0, index + 4), q, ...qs.slice(index + 4)]
      ;(async () => {
        await speak(['おしい！ これは、', q.a, 'だよ'])
        await wait(600)
        next()
      })()
    }
  }

  function celebrate(text: string, kind: Banner['kind'], who: CharId, x: number, y: number) {
    setBanner({ text, kind, key: Date.now() })
    setHelper(who)
    setTimeout(() => setHelper(null), 2600)
    setTimeout(() => setBanner(null), 1800)
    if (kind === 'fever') sfx.feverStart()
    else sfx.combo(kind === 'combo' ? 1 : 6)
    shake(kind === 'combo' ? 'small' : 'big')
    burst(x, y, 'star', 30, 1.3)
    if (kind !== 'combo') {
      fountain('coin', 40)
      rain('confetti', 120)
    }
    if (kind === 'legend') rain('banana', 30)
    return text
  }

  function endGame() {
    if (phaseRef.current === 'end') return
    phaseRef.current = 'end'
    setPhase('end')
    token.current++
    stopSpeaking()
    setFever(false)
    setBanner({ text: 'しゅうりょうー！', kind: 'end', key: Date.now() })
    sfx.whistle()
    void speak('しゅうりょうー！')
    setTimeout(() => {
      onFinish({ correct: stats.current.correct, total: stats.current.answers.length, coins: coinsRef.current, bestCombo: stats.current.bestCombo, answers: stats.current.answers })
    }, 2300)
  }

  function next() {
    if (phaseRef.current === 'end') return
    if (timeRef.current <= 0) return endGame()
    const qs = queueRef.current
    const ni = (index + 1) % qs.length
    setIndex(index + 1)
    setRound(makeRound(qs[ni], level))
  }

  const mood: Mood = phase === 'correct' ? 'happy' : phase === 'wrong' ? 'sad' : 'normal'
  const q = round.q
  const pct = (timeLeft / TIME_MAX) * 100

  return (
    <div className={`screen quiz ${fever ? 'is-fever' : ''}`}>
      <header className="quiz-top">
        <button className="quit" onClick={onQuit} aria-label="もどる">✕</button>
        <div className={`gauge ${pct < 17 ? 'low' : pct < 40 ? 'mid' : ''}`}>
          <div className="gauge-fill" style={{ width: `${pct}%` }} />
          <span className="gauge-icon">⏰</span>
          {timeGain && (
            <span key={timeGain.key} className={`time-gain ${timeGain.plus ? '' : 'minus'}`}>
              {timeGain.plus ? '+3' : '-3'}
            </span>
          )}
        </div>
        <div className="coin-badge">
          🍌 {coins}
          {gain && <span key={gain.key} className="gain">+{gain.n}</span>}
        </div>
      </header>

      <div className="stage">
        <div className="host">
          <div className="host-monkey">
            <PixelMonkey char={fever ? 'rainbow' : 'monchan'} mood={mood} size={60} anim={phase === 'correct' ? 'jump' : phase === 'wrong' ? 'slip' : 'idle'} />
            {phase === 'wrong' && <span className="peel">🍌</span>}
          </div>
          <div className={`bubble ${phase}`}>{bubble}</div>
        </div>
        {fever && <div className="fever-badge">ふぃーばー ×2</div>}
        {combo >= 2 && (
          <div className="combo" key={combo}>
            <span className="num">{combo}</span>
            <span>れんぞく！</span>
          </div>
        )}
      </div>

      <div className="picture-wrap">
        {phase === 'correct' && <div className={`sunburst ${isBonus ? 'gold' : ''}`} />}
        <div className={`picture ${phase} ${isBonus ? 'bonus' : ''}`} key={q.id + index}>
          {q.img ? <img src={q.img} alt="" draggable={false} /> : <span className="emoji">{q.e}</span>}
        </div>
        {phase === 'correct' && <div className="stamp">せいかい！</div>}
      </div>

      <div className="choices">
        {round.choices.map((c, i) => {
          const done = phase === 'correct' || phase === 'wrong' || phase === 'end'
          const state = done ? (c === q.a ? 'is-answer' : c === picked ? 'is-wrong' : 'is-dim') : selected === i ? 'is-selected' : reading === i ? 'is-reading' : ''
          return (
            <button
              key={c + index}
              ref={(el) => {
                choiceRefs.current[i] = el
              }}
              className={`btn choice ${state}`}
              style={{ fontSize: `min(30px, ${(74 / c.length).toFixed(1)}vw)` }}
              onClick={() => select(i)}
            >
              {c}
            </button>
          )
        })}
        <button className={`btn decide ${selected !== null && phase === 'answering' ? 'show' : ''}`} onClick={decide} aria-label="これにする">
          <PixelMonkey char="monchan" mood="happy" size={40} anim="none" />
          これ！
        </button>
      </div>

      {fever && (
        <>
          <div className="fever-frame" />
          <div className="fever-dancers">
            {DANCERS.map((c, i) => (
              <PixelMonkey key={c} char={c} mood="happy" size={34} anim="dance" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </>
      )}
      {banner && (
        <div className={`banner ${banner.kind}`} key={banner.key}>
          {banner.text}
        </div>
      )}
      {peeker && <PixelMonkey key={peeker.key} char={peeker.char} mood="happy" size={110} anim="none" className="peeker" />}
      {helper && <PixelMonkey key={helper} char={helper} mood="happy" size={120} anim="none" className="helper" />}
    </div>
  )
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
