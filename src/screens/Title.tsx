import { BananaPile } from '../components/BananaPile'
import { PixelMonkey } from '../components/PixelMonkey'
import { bananaStage } from '../lib/banana'
import { getPlayers, MAX_PLAYERS, type Player } from '../lib/players'
import { sfx } from '../lib/sound'

const LEVELS = [
  { level: 1, stars: '⭐', label: 'かんたん', color: '#3ee07a' },
  { level: 2, stars: '⭐⭐', label: 'ふつう', color: '#38b6ff' },
  { level: 3, stars: '⭐⭐⭐', label: 'むずかしい', color: '#ff5a8a' },
]
// テスト用: ?unlock=all で全部あそべる
const UNLOCK_ALL = new URLSearchParams(location.search).get('unlock') === 'all'

type Props = {
  player: Player
  onStart: (level: number) => void
  onReview: () => void
  onSettings: () => void
  onRanking: () => void
  onDiary: () => void
  onBook: () => void
  onSwitch: (id: string) => void
  onNewPlayer: () => void
}

/** タイトル（メニュー）。選んでいるキャラの見た目・なまえ・色で表示が変わる */
export function Title({ player, onStart, onReview, onSettings, onRanking, onDiary, onBook, onSwitch, onNewPlayer }: Props) {
  const { cleared, coins, review, stickers } = player.save
  // ひとつ前のコースをクリアすると解放。むずかしいは解放されるまで出さない
  const open = (level: number) => UNLOCK_ALL || level === 1 || cleared.includes(level - 1)
  const levels = LEVELS.filter((l) => l.level < 3 || open(l.level))
  const others = getPlayers().filter((p) => p.id !== player.id)

  return (
    <div className="screen title" style={{ '--theme': player.color } as React.CSSProperties}>
      <div className="title-top">
        <div className="coin-row">
          {/* ためたバナナの合計が「もの」の大きさで分かる（バナナのやま） */}
          <BananaPile stage={bananaStage(coins)} size={52} className="pile-mini" />
          <div className="coin-badge">🍌 {coins}</div>
        </div>
      </div>
      <h1 className="logo small">
        <span>おさるの</span>
        <span className="big">なあに？</span>
        <span>くいず</span>
      </h1>

      <div className="player-hero">
        <PixelMonkey key={player.id} char={player.char} mood="happy" size={80} anim="jump" />
        <span className="player-plate big">{player.name}</span>
      </div>

      {/* キャラのきりかえ（ほかのキャラ・あたらしいキャラ） */}
      <div className="player-switch">
        {others.map((p) => (
          <button
            key={p.id}
            className="player-chip"
            style={{ '--theme': p.color } as React.CSSProperties}
            onClick={() => {
              sfx.select()
              onSwitch(p.id)
            }}
          >
            <PixelMonkey char={p.char} size={34} anim="none" />
            <span>{p.name}</span>
          </button>
        ))}
        {getPlayers().length < MAX_PLAYERS && (
          <button className="player-chip add" onClick={() => { sfx.tap(); onNewPlayer() }} aria-label="キャラを ふやす">
            ＋
          </button>
        )}
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

      {/* まるいアイコンボタンの1行: ふくしゅう（まちがえた単語がたまっていたら）・えにっき（シールの枚数つき）・ずかん・らんきんぐ・せってい */}
      <div className="icon-row">
        {review.length > 0 && (
          <button className="icon-btn review-btn" onClick={() => { sfx.tap(); onReview() }} aria-label={`ふくしゅう ${review.length}もん`}>
            <span className="ic">🔁</span>
            <span className="lb">ふくしゅう</span>
            <span className="n">{review.length}</span>
          </button>
        )}
        <button className="icon-btn diary-btn" onClick={() => { sfx.tap(); onDiary() }} aria-label="えにっき">
          <span className="ic">📔</span>
          <span className="lb">えにっき</span>
          {stickers > 0 && <span className="n sticker-n">{stickers}</span>}
        </button>
        <button className="icon-btn book-btn" onClick={() => { sfx.tap(); onBook() }} aria-label="ずかん">
          <span className="ic">🎁</span>
          <span className="lb">ずかん</span>
        </button>
        <button className="icon-btn gear-btn rank-btn" onClick={() => { sfx.tap(); onRanking() }} aria-label="らんきんぐ">
          <span className="ic">🏆</span>
          <span className="lb">らんきんぐ</span>
        </button>
        <button className="icon-btn gear-btn settings-btn" onClick={() => { sfx.tap(); onSettings() }} aria-label="せってい">
          <span className="ic">⚙️</span>
          <span className="lb">せってい</span>
        </button>
      </div>
      <p className="credit">VOICEVOX:ずんだもん / 四国めたん / 春日部つむぎ / もち子(cv 明日葉よもぎ) / ナースロボ＿タイプＴ</p>
    </div>
  )
}
