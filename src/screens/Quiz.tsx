import { useEffect, useRef, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { burst, fountain, rain, shake, flash } from '../lib/effects'
import { makeRound, type Question, type Round } from '../lib/quiz'
import { sfx } from '../lib/sound'
import { speak, stopSpeaking } from '../lib/speech'
import type { CharId, Mood } from '../sprites/monkeys'

export type QuizResult = { correct: number; total: number; coins: number; bestCombo: number; answers: { id: string; ok: boolean }[] }

type Phase = 'reading' | 'answering' | 'correct' | 'wrong'
type Banner = { text: string; key: number; kind: 'combo' | 'fever' | 'legend' | 'bonus' }

const PRAISE = ['せいかい！', 'すごーい！', 'やったね！', 'あたり！', 'てんさい！']
const SESSION_EXTRA = 3 // まちがえた問題をもう一度出す上限
const PEEKERS: CharId[] = ['mandrill', 'orangutan', 'kinshikou', 'gorilla', 'rainbow']

export function Quiz({ level, questions, onFinish, onQuit }: { level: number; questions: Question[]; onFinish: (r: QuizResult) => void; onQuit: () => void }) {
  const [queue, setQueue] = useState(questions)
  const queueRef = useRef(questions)
  const [index, setIndex] = useState(0)
  const [round, setRound] = useState<Round>(() => makeRound(questions[0], level))
  const [phase, setPhase] = useState<Phase>('reading')
  const [reading, setReading] = useState(-1)
  const [picked, setPicked] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [combo, setCombo] = useState(0)
  const [coins, setCoins] = useState(0)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [fever, setFever] = useState(false)
  const [helper, setHelper] = useState<CharId | null>(null)
  const [bubble, setBubble] = useState('これ なあに？')
  const [peeker, setPeeker] = useState<{ char: CharId; key: number } | null>(null)
  // 1回の中でときどき「ボーナス問題」（金色・バナナ3ばい）
  const bonusAt = useRef(Math.random() < 0.7 ? 2 + Math.floor(Math.random() * Math.max(1, questions.length - 2)) : -1)
  const isBonus = index === bonusAt.current
  const stats = useRef({ correct: 0, bestCombo: 0, answers: [] as { id: string; ok: boolean }[], retried: 0 })
  const token = useRef(0) // 読み上げ途中で次へ進んだとき、古い非同期処理を止める

  // 問題が変わったら「これなあに？」→ 選択肢を順番に読み上げ
  useEffect(() => {
    const my = ++token.current
    setPhase('reading')
    setPicked(null)
    setSelected(null)
    setBubble('これ なあに？')
    const bonus = index === bonusAt.current
    if (bonus) {
      setBanner({ text: 'ぼーなす！', kind: 'bonus', key: Date.now() })
      setTimeout(() => setBanner(null), 1600)
      sfx.bonus()
      rain('star', 40)
    } else sfx.jajan()
    ;(async () => {
      await wait(bonus ? 1500 : 450)
      await speak('これ、なあに？')
      for (let i = 0; i < round.choices.length; i++) {
        if (token.current !== my) return
        setReading(i)
        await speak(round.choices[i])
        await wait(150)
      }
      if (token.current !== my) return
      setReading(-1)
      setPhase('answering')
    })()
    return () => stopSpeaking()
  }, [round])

  useEffect(() => () => document.body.classList.remove('fever'), [])
  useEffect(() => {
    document.body.classList.toggle('fever', fever)
  }, [fever])

  function center(el: Element) {
    const r = el.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2] as const
  }

  // 3歳児はひらがなが読めないので、1回目のタップは「選ぶ＋読み上げ」、
  // 同じボタンをもう一度 or「これ！」ボタンで回答する
  function select(i: number) {
    if (phase === 'correct' || phase === 'wrong') return
    const el = choiceRefs.current[i]
    if (selected === i && el) return answer(round.choices[i], el)
    token.current++
    stopSpeaking()
    setReading(-1)
    setSelected(i)
    setPhase('answering')
    setBubble('これかな？')
    sfx.tap()
    void speak(round.choices[i])
  }

  function decide() {
    if (selected === null) return
    const el = choiceRefs.current[selected]
    if (el) answer(round.choices[selected], el)
  }

  function answer(choice: string, el: HTMLElement) {
    if (phase === 'correct' || phase === 'wrong') return
    token.current++
    stopSpeaking()
    setReading(-1)
    setPicked(choice)
    const q = round.q
    const [x, y] = center(el)

    if (choice === q.a) {
      const c = combo + 1
      const add = 10 * (1 + Math.floor(c / 3)) * (isBonus ? 3 : 1)
      setCombo(c)
      setCoins((v) => v + add)
      setGain({ n: add, key: Date.now() })
      stats.current.correct++
      stats.current.bestCombo = Math.max(stats.current.bestCombo, c)
      stats.current.answers.push({ id: q.id, ok: true })
      setPhase('correct')
      setBubble(PRAISE[(Math.random() * PRAISE.length) | 0])

      sfx.correct(c)
      flash()
      burst(x, y, 'confetti', 60)
      burst(x, y, 'coin', 8 + Math.min(c, 10) * 2, 0.9)
      for (let i = 0; i < 4; i++) sfx.coin(0.35 + i * 0.09)
      if (c === 3 || (c > 3 && c % 3 === 0 && c < 5)) celebrate('すごい！', 'combo', 'mandrill', x, y)
      if (c === 5) {
        celebrate('ふぃーばー！', 'fever', 'gorilla', x, y)
        setFever(true)
      }
      if (c === 8) celebrate('でんせつ！', 'legend', 'rainbow', x, y)
      if (c > 5 && c !== 8) rain('banana', 6)
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
        await speak(`せいかい！ ${q.a}！`)
        await wait(500)
        next()
      })()
    } else {
      setCombo(0)
      setFever(false)
      stats.current.answers.push({ id: q.id, ok: false })
      setPhase('wrong')
      setBubble('おしい！')
      sfx.wrong()
      sfx.boing()
      shake('small')
      // まちがえた問題は最後にもう一度
      if (stats.current.retried < SESSION_EXTRA) {
        stats.current.retried++
        queueRef.current = [...queueRef.current, q]
        setQueue(queueRef.current)
      }
      ;(async () => {
        await speak(`おしい！ これは、${q.a}、だよ`)
        await wait(900)
        next()
      })()
    }
  }

  function celebrate(text: string, kind: Banner['kind'], who: CharId, x: number, y: number) {
    setBanner({ text, kind, key: Date.now() })
    setHelper(who)
    setTimeout(() => setHelper(null), 2600)
    setTimeout(() => setBanner(null), 1800)
    sfx.combo(kind === 'combo' ? 1 : kind === 'fever' ? 3 : 6)
    shake(kind === 'combo' ? 'small' : 'big')
    burst(x, y, 'star', 30, 1.3)
    if (kind !== 'combo') {
      fountain('coin', 40)
      rain('confetti', 120)
    }
    if (kind === 'legend') rain('banana', 30)
  }

  function next() {
    const qs = queueRef.current
    const ni = index + 1
    if (ni >= qs.length) {
      onFinish({ correct: stats.current.correct, total: stats.current.answers.length, coins: coinsRef.current, bestCombo: stats.current.bestCombo, answers: stats.current.answers })
    } else {
      setIndex(ni)
      setRound(makeRound(qs[ni], level))
    }
  }

  // next() は非同期で呼ばれるので最新のコインを ref で持つ
  const coinsRef = useRef(0)
  coinsRef.current = coins

  const mood: Mood = phase === 'correct' ? 'happy' : phase === 'wrong' ? 'sad' : 'normal'
  const q = round.q

  return (
    <div className="screen quiz">
      <header className="quiz-top">
        <button className="quit" onClick={onQuit} aria-label="もどる">✕</button>
        <div className="dots">
          {queue.map((_, i) => (
            <span key={i} className={`dot ${i < index ? 'done' : i === index ? 'now' : ''}`} />
          ))}
        </div>
        <div className="coin-badge">
          🍌 {coins}
          {gain && <span key={gain.key} className="gain">+{gain.n}</span>}
        </div>
      </header>

      <div className="stage">
        <div className="host">
          <div className="host-monkey">
            <PixelMonkey char={fever ? 'rainbow' : 'monchan'} mood={mood} size={84} anim={phase === 'correct' ? 'jump' : phase === 'wrong' ? 'slip' : 'idle'} />
            {phase === 'wrong' && <span className="peel">🍌</span>}
          </div>
          <div className={`bubble ${phase}`}>{bubble}</div>
        </div>
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
          const done = phase === 'correct' || phase === 'wrong'
          const state = done ? (c === q.a ? 'is-answer' : c === picked ? 'is-wrong' : 'is-dim') : selected === i ? 'is-selected' : reading === i ? 'is-reading' : ''
          return (
            <button
              key={c + index}
              ref={(el) => {
                choiceRefs.current[i] = el
              }}
              className={`btn choice ${state}`}
              style={{ fontSize: `min(36px, ${(78 / c.length).toFixed(1)}vw)` }}
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
