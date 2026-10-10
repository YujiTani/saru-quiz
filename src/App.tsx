import { useEffect, useRef, useState } from 'react'
import { MuteButton } from './components/MuteButton'
import { PixelMonkey } from './components/PixelMonkey'
import { attachEffects, burst } from './lib/effects'
import { pickSession, type Question } from './lib/quiz'
import { unlockAudio, sfx } from './lib/sound'
import { unlockSpeech, speak } from './lib/speech'
import { load, save, type Save } from './lib/storage'
import { Quiz, type QuizResult } from './screens/Quiz'
import { Result } from './screens/Result'
import { Title } from './screens/Title'

const SESSION_SIZE = 10

type Screen = { name: 'tap' } | { name: 'title' } | { name: 'quiz'; level: number; questions: Question[]; key: number } | { name: 'result'; level: number; result: QuizResult }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'tap' })
  const [data, setData] = useState<Save>(load)
  const fx = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (fx.current) attachEffects(fx.current)
    // どこをタップしてもキラキラ
    const onDown = (e: PointerEvent) => {
      burst(e.clientX, e.clientY, 'star', 7, 0.45)
      sfx.sparkle()
    }
    addEventListener('pointerdown', onDown)
    return () => removeEventListener('pointerdown', onDown)
  }, [])

  function startQuiz(level: number) {
    setScreen({ name: 'quiz', level, questions: pickSession(level, SESSION_SIZE, data.stats), key: Date.now() })
  }

  function finish(level: number, result: QuizResult) {
    const stats = { ...data.stats }
    for (const a of result.answers) {
      const s = stats[a.id] ?? { ok: 0, ng: 0, last: 0 }
      stats[a.id] = { ok: s.ok + (a.ok ? 1 : 0), ng: s.ng + (a.ok ? 0 : 1), last: Date.now() }
    }
    const next = { coins: data.coins + result.coins, bestCombo: Math.max(data.bestCombo, result.bestCombo), plays: data.plays + 1, stats }
    setData(next)
    save(next)
    setScreen({ name: 'result', level, result })
  }

  return (
    <>
      {screen.name === 'tap' && (
        <button
          className="screen tap-start"
          onClick={() => {
            // iOS: 音と読み上げはユーザー操作の中で初回起動が必要
            unlockAudio()
            unlockSpeech()
            sfx.coin()
            void speak('おさるの、なあにクイズ！')
            setScreen({ name: 'title' })
          }}
        >
          <PixelMonkey char="monchan" size={140} anim="jump" />
          <span className="tap-text">タップしてね</span>
        </button>
      )}
      {screen.name === 'title' && <Title coins={data.coins} onStart={startQuiz} />}
      {screen.name === 'quiz' && (
        <Quiz key={screen.key} level={screen.level} questions={screen.questions} onFinish={(r) => finish(screen.level, r)} onQuit={() => setScreen({ name: 'title' })} />
      )}
      {screen.name === 'result' && (
        <Result result={screen.result} totalCoins={data.coins} onAgain={() => startQuiz(screen.level)} onHome={() => setScreen({ name: 'title' })} />
      )}
      <MuteButton />
      <canvas ref={fx} className="fx" />
      <div id="flash" />
    </>
  )
}
