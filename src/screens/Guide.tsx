import { useEffect, useRef, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { Road } from '../components/Road'
import { ShowStage } from '../components/ShowStage'
import { Sticker } from '../components/Sticker'
import { GUIDE_PAGES } from '../lib/guide'
import { categories, questionById } from '../lib/quiz'
import { getCurrent } from '../lib/players'
import { getMotion } from '../lib/settings'
import { sfx } from '../lib/sound'
import { speak, stopSpeaking } from '../lib/speech'
import { demoUnlockCtx, ugokuFor } from '../shows'

const CAT = questionById('cat')
const DOG = questionById('dog')

/** ページ1: 絵のカードと選択肢の見本。おさるが「これ！」を押すしぐさをくり返す */
function SampleQuiz() {
  const [press, setPress] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setPress((p) => !p), 1300)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="g-sample g-quiz">
      <div className="g-card">{CAT?.img && <img src={CAT.img} alt="" draggable={false} />}</div>
      <div className="g-choices">
        <span className={`g-choice ${press ? 'on' : ''}`}>
          {CAT?.a ?? 'ねこ'}
          <span className={`g-finger ${press ? 'down' : ''}`} aria-hidden>
            👆
          </span>
        </span>
        <span className="g-choice">{DOG?.a ?? 'いぬ'}</span>
      </div>
      <div className="g-decide">
        <PixelMonkey char="monchan" mood="happy" size={36} anim={press ? 'jump' : 'none'} />
        これ！
      </div>
    </div>
  )
}

/** ページ2: どうぶつの うごくえ ＋ みちのりの見本 */
function SampleShow() {
  const [run, setRun] = useState(1)
  const [step, setStep] = useState(0)
  const show = ugokuFor('どうぶつ', demoUnlockCtx(categories.map((c) => c.name)))
  const char = getCurrent()?.char ?? 'monchan'
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 5), 1100)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="g-sample g-show">
      <ShowStage show={show} run={run} word={CAT} className="g-stage" onDone={() => setTimeout(() => setRun((r) => r + 1), 900)} />
      <Road correct={step} goal={4} theme="jungle" char={char} motion={getMotion()} />
    </div>
  )
}

/** ページ3: シール */
function SampleSticker() {
  return (
    <div className="g-sample g-sticker">
      <div className="g-sheet">
        {[0, 1, 2, 3].map((k) => (
          <span key={k} className="g-slot" style={{ animationDelay: `${k * 0.5}s` }}>
            <Sticker kind={k} size={52} />
          </span>
        ))}
      </div>
    </div>
  )
}

/** はじめてのガイド（3ページ）。おさるが動いて、読み上げと文字で説明する。暗い背景を押しても閉じない */
export function Guide({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0)
  const last = page === GUIDE_PAGES.length - 1
  const { title, body } = GUIDE_PAGES[page]
  const alive = useRef(true)

  // ページが変わるたびに、タイトルと説明を読み上げる
  useEffect(() => {
    alive.current = true
    stopSpeaking()
    void speak([title, body])
    return () => {
      alive.current = false
      stopSpeaking()
    }
  }, [page, title, body])

  function go(to: number) {
    sfx.tap()
    setPage(to)
  }
  function close() {
    sfx.tap()
    stopSpeaking()
    onClose()
  }

  return (
    <div className="guide" role="dialog" aria-modal="true" aria-label="あそびかた">
      <div className="guide-card">
        <div className="guide-dots" aria-hidden>
          {GUIDE_PAGES.map((_, i) => (
            <span key={i} className={`guide-dot ${i === page ? 'on' : ''}`} />
          ))}
        </div>
        <div className="guide-monkey">
          <PixelMonkey char="monchan" mood="happy" size={72} anim="jump" />
        </div>
        <div className="guide-page" key={page}>
          <h2 className="guide-title">{title}</h2>
          {page === 0 && <SampleQuiz />}
          {page === 1 && <SampleShow />}
          {page === 2 && <SampleSticker />}
          <p className="guide-body">{body}</p>
        </div>
        <div className="guide-nav">
          <button className="btn guide-back" style={{ visibility: page === 0 ? 'hidden' : 'visible' }} onClick={() => go(page - 1)}>
            もどる
          </button>
          <button className="btn guide-next" onClick={() => (last ? close() : go(page + 1))}>
            {last ? 'あそぶ！' : 'つぎへ'}
          </button>
        </div>
        {!last && (
          <button className="guide-skip" onClick={close}>
            とばす
          </button>
        )}
      </div>
    </div>
  )
}
