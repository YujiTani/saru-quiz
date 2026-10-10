import { PixelMonkey } from '../components/PixelMonkey'
import { sfx } from '../lib/sound'
import type { CharId } from '../sprites/monkeys'

const PARADE: CharId[] = ['mandrill', 'orangutan', 'monchan', 'gorilla', 'kinshikou', 'rainbow']
const LEVELS = [
  { level: 1, stars: '⭐', label: 'かんたん', color: '#3ee07a' },
  { level: 2, stars: '⭐⭐', label: 'ふつう', color: '#38b6ff' },
]

export function Title({ coins, onStart }: { coins: number; onStart: (level: number) => void }) {
  return (
    <div className="screen title">
      <div className="coin-badge">🍌 {coins}</div>
      <h1 className="logo">
        <span>おさるの</span>
        <span className="big">なあに？</span>
        <span>くいず</span>
      </h1>
      <div className="parade">
        {PARADE.map((c, i) => (
          <PixelMonkey key={c} char={c} size={c === 'monchan' ? 88 : 56} anim="dance" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className="levels">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            className="btn level-btn"
            style={{ '--c': l.color } as React.CSSProperties}
            onClick={() => {
              sfx.tap()
              onStart(l.level)
            }}
          >
            <span className="stars">{l.stars}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
