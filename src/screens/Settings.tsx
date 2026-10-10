import { useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { getTimeLimit, setTimeLimit, TIME_OPTIONS, type TimeLimit } from '../lib/settings'
import { sfx } from '../lib/sound'

const MONKEYS = ['mandrill', 'orangutan', 'kinshikou'] as const

/** せってい画面。制限時間を 15 / 30 / 45 秒から選ぶ */
export function Settings({ onBack }: { onBack: () => void }) {
  const [limit, setLimit] = useState<TimeLimit>(getTimeLimit)
  const choose = (v: TimeLimit) => {
    sfx.select()
    setLimit(v)
    setTimeLimit(v)
  }
  return (
    <div className="screen settings">
      <h1 className="settings-title">せってい</h1>
      <section className="settings-card">
        <h2 className="settings-label">⏰ せいげんじかん</h2>
        <p className="settings-note">ゲームの ながさ を えらんでね</p>
        <div className="time-options">
          {TIME_OPTIONS.map((v, i) => (
            <button
              key={v}
              className={`btn time-btn ${limit === v ? 'is-on' : ''}`}
              onClick={() => choose(v)}
              aria-pressed={limit === v}
            >
              <PixelMonkey char={MONKEYS[i]} mood={limit === v ? 'happy' : 'normal'} size={44} anim={limit === v ? 'dance' : 'none'} />
              <span className="time-num">{v}</span>
              <span className="time-unit">びょう</span>
            </button>
          ))}
        </div>
      </section>
      <button className="btn back-btn" onClick={() => { sfx.tap(); onBack() }}>もどる</button>
    </div>
  )
}
