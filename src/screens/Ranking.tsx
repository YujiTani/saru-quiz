import { useEffect, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { COURSE } from '../lib/quiz'
import { fetchRanking, formatTime, getMyPubId, rankingEnabled, type Period, type ScoreRow } from '../lib/ranking'
import { sfx } from '../lib/sound'

const MEDAL = ['🥇', '🥈', '🥉']

/** ランキング（かんたん / ふつう × きょう / こんげつ） */
export function Ranking({ initialCourse = 1, onBack }: { initialCourse?: number; onBack: () => void }) {
  const [course, setCourse] = useState(initialCourse)
  const [period, setPeriod] = useState<Period>('day')
  const [rows, setRows] = useState<ScoreRow[] | null>(null)
  const [error, setError] = useState(false)
  const [me, setMe] = useState('')

  useEffect(() => {
    void getMyPubId().then(setMe)
  }, [])

  useEffect(() => {
    if (!rankingEnabled()) return
    let alive = true
    setRows(null)
    setError(false)
    fetchRanking(course, period)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [course, period])

  const tab = <T,>(value: T, current: T, set: (v: T) => void, label: string) => (
    <button
      className={`btn rank-tab ${value === current ? 'is-on' : ''}`}
      onClick={() => {
        sfx.select()
        set(value)
      }}
      aria-pressed={value === current}
    >
      {label}
    </button>
  )

  return (
    <div className="screen ranking">
      <h1 className="settings-title">🏆 らんきんぐ</h1>
      <div className="rank-tabs">
        {tab(1, course, setCourse, COURSE[1].name)}
        {tab(2, course, setCourse, COURSE[2].name)}
      </div>
      <div className="rank-tabs">
        {tab<Period>('day', period, setPeriod, 'きょう')}
        {tab<Period>('month', period, setPeriod, 'こんげつ')}
      </div>

      <section className="settings-card rank-list">
        {!rankingEnabled() ? (
          <p className="rank-msg">ランキングは じゅんびちゅう だよ</p>
        ) : error ? (
          <p className="rank-msg">つながらないよ。あとで みてね</p>
        ) : rows === null ? (
          <p className="rank-msg">よみこみちゅう…</p>
        ) : rows.length === 0 ? (
          <p className="rank-msg">まだ だれも いないよ。いちばんのりしよう！</p>
        ) : (
          <ol>
            {rows.map((r, i) => (
              <li key={r.pub_id} className={r.pub_id === me ? 'is-me' : ''}>
                <span className="rank-no">{MEDAL[i] ?? `${i + 1}`}</span>
                <span className="rank-name">{r.name}</span>
                <span className="rank-score">{r.cleared && r.clear_ms !== null ? `⏱${formatTime(r.clear_ms)}` : `${r.correct}もん`}</span>
                <span className="rank-banana">🍌{r.bananas}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="settings-foot">
        <PixelMonkey char="gorilla" mood="happy" size={44} anim="idle" />
        <button className="btn back-btn" onClick={() => { sfx.tap(); onBack() }}>
          もどる
        </button>
      </div>
    </div>
  )
}
