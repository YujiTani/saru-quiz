import { PixelMonkey } from '../components/PixelMonkey'
import { sfx } from '../lib/sound'
import type { CharId } from '../sprites/monkeys'

const PARADE: CharId[] = ['mandrill', 'sora', 'orangutan', 'monchan', 'gorilla', 'mint', 'kinshikou', 'choco', 'rainbow']
const LEVELS = [
  { level: 1, stars: '⭐', label: 'かんたん', color: '#3ee07a' },
  { level: 2, stars: '⭐⭐', label: 'ふつう', color: '#38b6ff' },
  { level: 3, stars: '⭐⭐⭐', label: 'むずかしい', color: '#ff5a8a' },
]
// テスト用: ?unlock=all で全部あそべる
const UNLOCK_ALL = new URLSearchParams(location.search).get('unlock') === 'all'

type Props = { coins: number; cleared: number[]; onStart: (level: number) => void; onSettings: () => void; onRanking: () => void }

export function Title({ coins, cleared, onStart, onSettings, onRanking }: Props) {
  // ひとつ前のコースをクリアすると解放。むずかしいは解放されるまで出さない
  const open = (level: number) => UNLOCK_ALL || level === 1 || cleared.includes(level - 1)
  const levels = LEVELS.filter((l) => l.level < 3 || open(l.level))

  return (
    <div className="screen title">
      <div className="title-top">
        <div className="title-btns">
          <button className="gear-btn" onClick={() => { sfx.tap(); onSettings() }} aria-label="せってい">⚙️</button>
          <button className="gear-btn" onClick={() => { sfx.tap(); onRanking() }} aria-label="らんきんぐ">🏆</button>
        </div>
        <div className="coin-badge">🍌 {coins}</div>
      </div>
      <h1 className="logo">
        <span>おさるの</span>
        <span className="big">なあに？</span>
        <span>くいず</span>
      </h1>
      <div className="parade">
        {PARADE.map((c, i) => (
          <PixelMonkey key={c} char={c} size={c === 'monchan' ? 64 : 38} anim="dance" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className="levels">
        {levels.map((l) =>
          open(l.level) ? (
            <button
              key={l.level}
              className={`btn level-btn ${l.level === 3 && !cleared.includes(3) ? 'is-new' : ''}`}
              style={{ '--c': l.color } as React.CSSProperties}
              onClick={() => {
                sfx.tap()
                onStart(l.level)
              }}
            >
              <span className="stars">{l.stars}</span>
              <span>{l.label}</span>
            </button>
          ) : (
            <button key={l.level} className="btn level-btn is-locked" onClick={() => sfx.boing()}>
              <span className="stars">🔒</span>
              <span className="lock-text">
                {l.label}
                <small>{LEVELS[l.level - 2].label}を くりあ したら あそべるよ</small>
              </span>
            </button>
          ),
        )}
      </div>
      <p className="credit">VOICEVOX:ずんだもん / 四国めたん / 春日部つむぎ / もち子(cv 明日葉よもぎ) / ナースロボ＿タイプＴ</p>
    </div>
  )
}
