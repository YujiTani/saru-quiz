import { useEffect, useReducer, useRef, useState } from 'react'
import { PixelMonkey } from './components/PixelMonkey'
import { attachEffects, burst } from './lib/effects'
import { COURSE, pickSession, type Question } from './lib/quiz'
import { resumeAudio, unlockAudio, sfx } from './lib/sound'
import { unlockSpeech, speak } from './lib/speech'
import { getCurrent, onPlayersChange, savePlayerData, selectPlayer } from './lib/players'
import { emptySave } from './lib/storage'
import { flushPending } from './lib/ranking'
import { Quiz, type QuizResult } from './screens/Quiz'
import { Ranking } from './screens/Ranking'
import { Result } from './screens/Result'
import { PlayerEdit } from './screens/PlayerEdit'
import { Settings } from './screens/Settings'
import { Title } from './screens/Title'

// 出題はクリアに必要な数＋予備（足りなければ先頭に戻る）
const sessionSize = (level: number) => (COURSE[level]?.goal ?? 100) + 30

type Screen =
  | { name: 'tap' }
  | { name: 'title' }
  | { name: 'settings' }
  | { name: 'player'; edit: boolean; first?: boolean; back: 'title' | 'settings' }
  | { name: 'ranking'; course: number }
  | { name: 'quiz'; level: number; questions: Question[]; key: number }
  | { name: 'result'; level: number; result: QuizResult }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'tap' })
  // キャラ（プレイヤー）が変わったら描き直す。進捗データは選んでいるキャラのもの
  const [, refresh] = useReducer((x: number) => x + 1, 0)
  useEffect(() => onPlayersChange(refresh), [])
  const player = getCurrent()
  const data = player?.save ?? emptySave()
  const fx = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (fx.current) attachEffects(fx.current)
    // どこをタップしてもキラキラ
    const onDown = (e: PointerEvent) => {
      resumeAudio()
      burst(e.clientX, e.clientY, 'star', 7, 0.45)
      sfx.sparkle()
    }
    addEventListener('pointerdown', onDown)
    // オフラインでためていたスコアを送り直す
    void flushPending()
    return () => removeEventListener('pointerdown', onDown)
  }, [])

  function startQuiz(level: number) {
    setScreen({ name: 'quiz', level, questions: pickSession(level, sessionSize(level), data.stats), key: Date.now() })
  }

  function finish(level: number, result: QuizResult) {
    const stats = { ...data.stats }
    for (const a of result.answers) {
      const s = stats[a.id] ?? { ok: 0, ng: 0, last: 0 }
      stats[a.id] = { ok: s.ok + (a.ok ? 1 : 0), ng: s.ng + (a.ok ? 0 : 1), last: Date.now() }
    }
    const cleared = result.cleared && !data.cleared.includes(level) ? [...data.cleared, level] : data.cleared
    const next = { coins: data.coins + result.coins, bestCombo: Math.max(data.bestCombo, result.bestCombo), plays: data.plays + 1, cleared, stats }
    if (player) savePlayerData(player.id, next)
    setScreen({ name: 'result', level, result })
  }

  return (
    <>
      <header className="app-header">
        <span className="app-title">おさるのなあに？クイズ</span>
        {/* タイトルにもどる（はじめてのキャラづくり中は出さない） */}
        {screen.name !== 'tap' && screen.name !== 'title' && player && (
          <button className="home-btn" onClick={() => { sfx.tap(); setScreen({ name: 'title' }) }} aria-label="タイトルにもどる">
            🏠 たいとる
          </button>
        )}
      </header>
      {screen.name === 'tap' && (
        <button
          className="screen tap-start"
          onClick={() => {
            // iOS: 音と読み上げはユーザー操作の中で初回起動が必要
            unlockAudio()
            unlockSpeech()
            sfx.coin()
            void speak('おさるの、なあにクイズ！')
            // はじめてなら、まずキャラをつくる
            setScreen(getCurrent() ? { name: 'title' } : { name: 'player', edit: false, first: true, back: 'title' })
          }}
        >
          <PixelMonkey char="monchan" size={140} anim="jump" />
          <span className="tap-text">タップしてね</span>
        </button>
      )}
      {screen.name === 'title' && player && (
        <Title
          player={player}
          onStart={startQuiz}
          onSettings={() => setScreen({ name: 'settings' })}
          onRanking={() => setScreen({ name: 'ranking', course: 1 })}
          onSwitch={(id) => {
            selectPlayer(id)
            const p = getCurrent()
            if (p) void speak(`${p.name}、がんばろう！`)
          }}
          onNewPlayer={() => setScreen({ name: 'player', edit: false, back: 'title' })}
        />
      )}
      {screen.name === 'player' && (
        <PlayerEdit
          key={`${screen.edit}-${player?.id}`}
          player={screen.edit && player ? player : undefined}
          first={screen.first}
          onDone={() => setScreen(getCurrent() ? ({ name: screen.back } as Screen) : { name: 'player', edit: false, first: true, back: 'title' })}
          onBack={() => setScreen({ name: screen.back } as Screen)}
        />
      )}
      {screen.name === 'settings' && <Settings onBack={() => setScreen({ name: 'title' })} onEditPlayer={() => setScreen({ name: 'player', edit: true, back: 'settings' })} />}
      {screen.name === 'ranking' && <Ranking initialCourse={screen.course} onBack={() => setScreen({ name: 'title' })} />}
      {screen.name === 'quiz' && (
        <Quiz key={screen.key} level={screen.level} questions={screen.questions} onFinish={(r) => finish(screen.level, r)} onQuit={() => setScreen({ name: 'title' })} />
      )}
      {screen.name === 'result' && (
        <Result
          level={screen.level}
          result={screen.result}
          totalCoins={data.coins}
          onAgain={() => startQuiz(screen.level)}
          onHome={() => setScreen({ name: 'title' })}
          onRanking={() => setScreen({ name: 'ranking', course: screen.level })}
        />
      )}
      <canvas ref={fx} className="fx" />
      <div id="flash" />
    </>
  )
}
