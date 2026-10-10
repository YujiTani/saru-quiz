// プレゼント: 新しく手に入れた演出を、おさるが箱に入れて持ってくる。箱がゆれて パカッと開き、
// アイコンと名前が出て「あたらしい えんしゅつ！」→ その演出を1回ためす
import { useEffect, useRef, useState } from 'react'
import { burst } from '../lib/effects'
import { getCurrent } from '../lib/players'
import { sfx } from '../lib/sound'
import { speak } from '../lib/speech'
import { getShow } from '../shows'
import { PixelMonkey } from './PixelMonkey'
import { ShowStage } from './ShowStage'

type Phase = 'carry' | 'shake' | 'open' | 'show'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function ShowGift({ showId, onDone }: { showId: string; onDone: () => void }) {
  const show = getShow(showId)
  const [phase, setPhase] = useState<Phase>('carry')
  const [run, setRun] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const stageDone = useRef<(() => void) | null>(null)
  const finish = useRef(onDone)
  finish.current = onDone
  const char = getCurrent()?.char ?? 'monchan'

  useEffect(() => {
    let alive = true
    void (async () => {
      sfx.whoosh()
      await sleep(900) // おさるが箱を持って出てくる
      if (!alive) return
      setPhase('shake')
      sfx.boing()
      await sleep(1000) // 箱がゆれる
      if (!alive) return
      setPhase('open')
      sfx.openBox()
      const r = root.current?.getBoundingClientRect()
      if (r) burst(r.left + r.width / 2, r.top + 90, 'star', 24, 1.1)
      await sleep(550) // パカッ
      if (!alive) return
      setPhase('show')
      await speak('あたらしい、えんしゅつ！')
      if (!alive) return
      // その演出を、舞台で1回ためす（舞台が見えるところまでスクロールしてから）
      root.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await sleep(700)
      if (!alive) return
      await new Promise<void>((resolve) => {
        stageDone.current = resolve
        setRun(1)
        setTimeout(resolve, 9000) // 万一終わらなくても先へ
      })
      if (!alive) return
      await sleep(600)
      if (alive) finish.current()
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!show) return null
  const opened = phase === 'open' || phase === 'show'
  return (
    <div className={`learn-card gift-card pop phase-${phase}`} data-show={showId} ref={root}>
      <div className="gift-scene">
        <div className="gift-carrier">
          <PixelMonkey char={char} mood="happy" size={64} anim={phase === 'carry' ? 'jump' : 'idle'} />
          <div className="gift-reveal" aria-hidden>
            <div className={`gift-box ${opened ? 'is-open' : ''}`}>
              <div className="gift-lid">
                <span className="gift-bow">🎀</span>
              </div>
              <div className="gift-body">
                <div className="gift-ribbon" />
              </div>
            </div>
            {opened && <span className="gift-icon">{show.icon}</span>}
          </div>
        </div>
      </div>
      {phase === 'show' && (
        <>
          <div className="learn-title gift-title">🎁 あたらしい えんしゅつ！</div>
          <div className="gift-name">
            <span className="gift-name-icon">{show.icon}</span>
            {show.name}
          </div>
          <ShowStage show={show} run={run} onDone={() => stageDone.current?.()} className="gift-stage" />
        </>
      )}
    </div>
  )
}
