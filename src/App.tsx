import { useEffect, useReducer, useRef, useState } from 'react'
import { PixelMonkey } from './components/PixelMonkey'
import { attachEffects, burst, setMotion as setEffectsMotion } from './lib/effects'
import { getMotion, onSettingsChange } from './lib/settings'
import { attachLayer } from './shows'
import { COURSE, MODE_RULES, REVIEW_LEVEL, pickSession, reviewSession, type Mode, type Question } from './lib/quiz'
import { resumeAudio, unlockAudio, sfx } from './lib/sound'
import { unlockSpeech, speak } from './lib/speech'
import { getCurrent, onPlayersChange, savePlayerData, selectPlayer } from './lib/players'
import { emptySave } from './lib/storage'
import { now } from './lib/day'
import { applyResult, type ResultEvents } from './lib/progress'
import { isTestRun } from './lib/testflags'
import { flushPending } from './lib/ranking'
import { Diary } from './screens/Diary'
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
  | { name: 'diary' }
  | { name: 'quiz'; mode: Mode; level: number; questions: Question[]; key: number }
  | { name: 'result'; mode: Mode; level: number; result: QuizResult; events: ResultEvents }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'tap' })
  // キャラ（プレイヤー）が変わったら描き直す。進捗データは選んでいるキャラのもの
  const [, refresh] = useReducer((x: number) => x + 1, 0)
  useEffect(() => onPlayersChange(refresh), [])
  const player = getCurrent()
  const data = player?.save ?? emptySave()
  const fx = useRef<HTMLCanvasElement>(null)
  const showLayer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fx.current) attachEffects(fx.current)
    if (showLayer.current) attachLayer(showLayer.current)
    // 動きの強さ（設定）を演出に反映する
    setEffectsMotion(getMotion())
    const offSettings = onSettingsChange(() => setEffectsMotion(getMotion()))
    // どこをタップしてもキラキラ
    const onDown = (e: PointerEvent) => {
      resumeAudio()
      burst(e.clientX, e.clientY, 'star', 7, 0.45)
      sfx.sparkle()
    }
    addEventListener('pointerdown', onDown)
    // オフラインでためていたスコアを送り直す
    void flushPending()
    return () => {
      removeEventListener('pointerdown', onDown)
      offSettings()
    }
  }, [])

  /** コースを始める（mode 'course'）か、ふくしゅうを始める（mode 'review'。level は選択肢の難しさだけに使う） */
  function startQuiz(mode: Mode, level: number = REVIEW_LEVEL) {
    const questions = mode === 'review' ? reviewSession(data.review) : pickSession(level, sessionSize(level), data.stats)
    if (questions.length === 0) return setScreen({ name: 'title' })
    setScreen({ name: 'quiz', mode, level, questions, key: Date.now() })
  }

  function finish(mode: Mode, level: number, result: QuizResult) {
    const { save, events } = applyResult(data, result, now(), level, mode === 'review')
    // テスト用のURLのときは記録しない
    if (player && !isTestRun()) savePlayerData(player.id, save)
    setScreen({ name: 'result', mode, level, result, events })
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
          onStart={(level) => startQuiz('course', level)}
          onReview={() => startQuiz('review')}
          onSettings={() => setScreen({ name: 'settings' })}
          onRanking={() => setScreen({ name: 'ranking', course: 1 })}
          onDiary={() => setScreen({ name: 'diary' })}
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
      {screen.name === 'diary' && player && <Diary player={player} />}
      {screen.name === 'ranking' && <Ranking initialCourse={screen.course} onBack={() => setScreen({ name: 'title' })} />}
      {screen.name === 'quiz' && (
        <Quiz key={screen.key} mode={screen.mode} level={screen.level} questions={screen.questions} save={data} onFinish={(r) => finish(screen.mode, screen.level, r)} onQuit={() => setScreen({ name: 'title' })} />
      )}
      {screen.name === 'result' && (
        <Result
          mode={screen.mode}
          level={screen.level}
          result={screen.result}
          events={screen.events}
          totalCoins={data.coins}
          onAgain={() => (screen.mode === 'review' && data.review.length === 0 ? setScreen({ name: 'title' }) : startQuiz(screen.mode, screen.level))}
          onHome={() => setScreen({ name: 'title' })}
          onRanking={() => setScreen({ name: 'ranking', course: MODE_RULES[screen.mode].ranked ? screen.level : 1 })}
        />
      )}
      <div id="show-layer" className="show-layer" ref={showLayer} />
      <canvas ref={fx} className="fx" />
      <div id="flash" />
    </>
  )
}
