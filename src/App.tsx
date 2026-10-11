import { useEffect, useReducer, useRef, useState } from 'react'
import { PixelMonkey } from './components/PixelMonkey'
import { attachEffects, burst, setMotion as setEffectsMotion } from './lib/effects'
import { getGuideSeen, getMotion, onSettingsChange, setGuideSeen } from './lib/settings'
import { demoSession, shouldRecord } from './lib/demo'
import { shouldShowGuide } from './lib/guide'
import { attachLayer } from './shows'
import { COURSE, MODE_RULES, REVIEW_LEVEL, pickSession, practiceLevel, practiceSession, reviewSession, type Mode, type Question } from './lib/quiz'
import { resumeAudio, unlockAudio, sfx } from './lib/sound'
import { unlockSpeech, speak } from './lib/speech'
import { getCurrent, onPlayersChange, savePlayerData, selectPlayer } from './lib/players'
import { emptySave } from './lib/storage'
import { now } from './lib/day'
import { applyResult, type ResultEvents } from './lib/progress'
import { demoParam, isTestRun } from './lib/testflags'
import { flushPending } from './lib/ranking'
import { Guide } from './screens/Guide'
import { Diary } from './screens/Diary'
import { Quiz, type QuizResult } from './screens/Quiz'
import { Parent } from './screens/Parent'
import { Ranking } from './screens/Ranking'
import { Result } from './screens/Result'
import { ShowBook } from './screens/ShowBook'
import { PlayerEdit } from './screens/PlayerEdit'
import { Settings } from './screens/Settings'
import { Title } from './screens/Title'
import { WordBook } from './screens/WordBook'

// 出題はクリアに必要な数＋予備（足りなければ先頭に戻る）
const sessionSize = (level: number) => (COURSE[level]?.goal ?? 100) + 30

type Screen =
  | { name: 'tap' }
  | { name: 'title' }
  | { name: 'settings' }
  | { name: 'player'; edit: boolean; first?: boolean; back: 'title' | 'settings' }
  | { name: 'ranking'; course: number }
  | { name: 'diary' }
  | { name: 'book' }
  | { name: 'words'; cat?: string }
  | { name: 'parent' }
  // cat: れんしゅうのカテゴリ（れんしゅうのときだけ）
  | { name: 'quiz'; mode: Mode; level: number; questions: Question[]; key: number; cat?: string }
  | { name: 'result'; mode: Mode; level: number; result: QuizResult; events: ResultEvents; cat?: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'tap' })
  // はじめてのガイド。はじめてタイトルに来たとき1回だけ自動で出て、タイトルの「？」でいつでも出せる
  const [guide, setGuide] = useState(false)
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

  // はじめてタイトルに来たとき（ガイドを見ていなければ）1回だけ出す。出した時点で「見た」にする
  useEffect(() => {
    if (screen.name === 'title' && player && !isTestRun() && shouldShowGuide(getGuideSeen())) {
      setGuideSeen()
      setGuide(true)
    }
  }, [screen.name, player])

  /** デモ（おさるが自動で10問あそぶ）。何も記録しない */
  function startDemo() {
    setScreen({ name: 'quiz', mode: 'demo', level: 1, questions: demoSession(), key: Date.now() })
  }

  /** コースを始める（mode 'course'）、ふくしゅう（'review'。level は選択肢の難しさだけに使う）、れんしゅう（'practice'。cat のカテゴリ10問） */
  function startQuiz(mode: Mode, level: number = REVIEW_LEVEL, cat?: string) {
    if (mode === 'practice' && cat) level = practiceLevel(cat)
    const questions = mode === 'review' ? reviewSession(data.review) : mode === 'practice' ? practiceSession(cat ?? '', data.stats) : pickSession(level, sessionSize(level), data.stats)
    if (questions.length === 0) return setScreen({ name: 'title' })
    setScreen({ name: 'quiz', mode, level, questions, key: Date.now(), cat })
  }

  function finish(mode: Mode, level: number, result: QuizResult, cat?: string) {
    const { save, events } = applyResult(data, result, now(), level, mode)
    // テスト用のURLのときは記録しない
    if (player && shouldRecord(MODE_RULES[mode], isTestRun())) savePlayerData(player.id, save)
    setScreen({ name: 'result', mode, level, result, events, cat })
  }

  // れんしゅうのあとは ことば図鑑のそのカテゴリへ、ほかはタイトルへ
  const leave = (mode: Mode, cat?: string): Screen => (mode === 'practice' ? { name: 'words', cat } : { name: 'title' })

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
            // ?demo ならデモを始める。はじめてなら、まずキャラをつくる
            if (demoParam() && getCurrent()) return startDemo()
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
          onBook={() => setScreen({ name: 'book' })}
          onWords={() => setScreen({ name: 'words' })}
          onGuide={() => setGuide(true)}
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
      {screen.name === 'settings' && <Settings onBack={() => setScreen({ name: 'title' })} onEditPlayer={() => setScreen({ name: 'player', edit: true, back: 'settings' })} onParent={() => setScreen({ name: 'parent' })} onDemo={startDemo} />}
      {screen.name === 'parent' && player && <Parent player={player} onBack={() => setScreen({ name: 'settings' })} />}
      {screen.name === 'words' && player && <WordBook player={player} initialCat={screen.cat} onPractice={(cat) => startQuiz('practice', 1, cat)} onBack={() => setScreen({ name: 'title' })} />}
      {screen.name === 'diary' && player && <Diary player={player} />}
      {screen.name === 'book' && player && <ShowBook player={player} onBack={() => setScreen({ name: 'title' })} />}
      {screen.name === 'ranking' && <Ranking initialCourse={screen.course} onBack={() => setScreen({ name: 'title' })} />}
      {screen.name === 'quiz' && (
        <Quiz key={screen.key} mode={screen.mode} level={screen.level} questions={screen.questions} save={data} onFinish={(r) => finish(screen.mode, screen.level, r, screen.cat)} onQuit={() => setScreen(leave(screen.mode, screen.cat))} />
      )}
      {screen.name === 'result' && (
        <Result
          mode={screen.mode}
          level={screen.level}
          result={screen.result}
          events={screen.events}
          totalCoins={data.coins}
          onAgain={() => (screen.mode === 'review' && data.review.length === 0 ? setScreen({ name: 'title' }) : startQuiz(screen.mode, screen.level, screen.cat))}
          onHome={() => setScreen(leave(screen.mode, screen.cat))}
          onRanking={() => setScreen({ name: 'ranking', course: MODE_RULES[screen.mode].ranked ? screen.level : 1 })}
        />
      )}
      {guide && <Guide onClose={() => setGuide(false)} />}
      <div id="show-layer" className="show-layer" ref={showLayer} />
      <canvas ref={fx} className="fx" />
      <div id="flash" />
    </>
  )
}
