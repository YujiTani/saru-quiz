// 図鑑の「ためす」・プレゼントの舞台。小さなクイズの画面（司会のおさる・吹き出し・絵のカード）に、演出を1回流す
// みちのりは Road、おんがくは おさるバンドを舞台に出す。run が増えるたびに最初から再生する
import { useEffect, useMemo, useRef, useState } from 'react'
import { getMotion } from '../lib/settings'
import { getCurrent } from '../lib/players'
import { stopBgm } from '../lib/sound'
import { layer, themeOf, type Show } from '../shows'
import { ROAD_GOAL, previewWord, runPreview, type Cancel } from '../shows/preview'
import { wait } from '../shows/util'
import type { Question } from '../lib/quiz'
import { Band } from './Band'
import { Cheer } from './Cheer'
import { PixelMonkey } from './PixelMonkey'
import { Road } from './Road'

type Props = {
  /** 流す演出（なければ 見本のカードだけ） */
  show: Show | null
  /** 増えるたびに再生する（0 は再生しない） */
  run: number
  /** 再生がおわったとき */
  onDone?: () => void
  className?: string
}

const IDLE = 'これ なあに？'

export function ShowStage({ show, run, onDone, className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const picRef = useRef<HTMLDivElement>(null)
  const [E, setE] = useState(0)
  const [bubble, setBubble] = useState(IDLE)
  const [cheer, setCheer] = useState<{ E: number; words: Question[]; correct: number } | null>(null)
  const motion = getMotion()
  const char = getCurrent()?.char ?? 'monchan'
  const word = useMemo(() => previewWord(show, run), [show, run])
  const cat = show?.cat
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (!run || !show) return
    const cancel: Cancel = { cancelled: false }
    layer.clear()
    setE(0)
    setCheer(null)
    setBubble(show.cat === 'zukkoke' ? 'おしい！' : show.cat === 'ugoku' ? 'せいかい！' : IDLE)
    void (async () => {
      await wait(show.cat === 'michi' || show.cat === 'ongaku' ? 150 : 600) // カードが入ってくる動きが終わってから
      if (cancel.cancelled) return
      await runPreview(show, { host: hostRef.current, pic: picRef.current }, word, { setE, setCheer }, cancel)
      if (cancel.cancelled) return
      layer.clear() // 「ふせ」のまま残った おさるの傾きなどを もどす
      setBubble(IDLE)
      done.current?.()
    })()
    return () => {
      cancel.cancelled = true
      layer.clear()
      stopBgm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, show?.id]) // タブを切りかえて show がなくなったら、再生中のものも止める

  const music = cat === 'michi' || cat === 'ongaku'
  return (
    <div className={`pv-stage ${music ? 'is-music' : ''} ${className}`} data-cat={cat ?? 'none'}>
      {cat === 'michi' && show && <Road correct={Math.round(E * ROAD_GOAL)} goal={ROAD_GOAL} theme={themeOf(show.id)} char={char} motion={motion} />}
      <div className="stage">
        <div className="host">
          <div className="host-monkey" ref={hostRef}>
            <PixelMonkey char="monchan" mood="normal" size={60} anim="idle" />
          </div>
          <div className="bubble">{bubble}</div>
        </div>
        {cat === 'ongaku' && <Band E={E} motion={motion} />}
      </div>
      {music ? (
        <div className="pv-label" aria-hidden>
          <span className="pv-icon">{show?.icon}</span>
          <span>{show?.name}</span>
        </div>
      ) : (
        <div className="picture-wrap">
          <div className="picture" ref={picRef} key={word.id}>
            {word.img ? <img src={word.img} alt="" draggable={false} /> : <span className="emoji">{word.e}</span>}
          </div>
          {cheer && show && <Cheer id={show.id} E={cheer.E} motion={motion} words={cheer.words} correct={cheer.correct} />}
        </div>
      )}
    </div>
  )
}
