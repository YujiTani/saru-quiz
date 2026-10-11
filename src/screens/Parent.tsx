import { useMemo, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { now } from '../lib/day'
import { clearAll, clearWord, playSummary, recentPlays, recordedWords, troubleWords } from '../lib/parent'
import { savePlayerData, type Player } from '../lib/players'
import { categories, type Question } from '../lib/quiz'
import { sfx } from '../lib/sound'

// ぜんぶ消すの警告の見た目（styles の .delete-warn / .delete-btn の step1〜3。だんだん強く）
const LOOK = [0, 2, 3]
const MAX_LIST = 12 // 消す相手の候補を並べる最大数（多いときは絞りこんでもらう）

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return `${m}/${d}（${WEEK[new Date(y, m - 1, d).getDay()]}）`
}

const Pic = ({ q }: { q: Question }) => (q.img ? <img src={q.img} alt="" draggable={false} /> : <span className="emoji">{q.e}</span>)

/**
 * 保護者メニュー（設定画面の「おうちのかた」を2秒長押しで開く）。親向けなので、漢字かな交じりの普通の日本語。
 * このキャラの記録・苦手なことば・1語の記録を消す（確認1回）・このキャラの記録をぜんぶ消す（確認2回。名前と見た目は残る）
 */
export function Parent({ player, onBack }: { player: Player; onBack: () => void }) {
  const { save } = player
  const nowMs = now()
  const sum = useMemo(() => playSummary(save, nowMs), [save, nowMs])
  const week = useMemo(() => recentPlays(save, nowMs, 7), [save, nowMs])
  const weekMax = Math.max(1, ...week.map((d) => d.plays))
  const trouble = useMemo(() => troubleWords(save.stats, 10), [save.stats])

  // 1語の記録を消す
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('')
  const [target, setTarget] = useState<Question | null>(null)
  const [notice, setNotice] = useState('')
  const found = useMemo(() => recordedWords(save.stats, query, cat), [save.stats, query, cat])

  // ぜんぶ消す（確認2回）
  const [step, setStep] = useState(0)
  const WARN = [
    '',
    `「${player.name}」の記録（おぼえたことば・☆・バナナ・えにっき・シールなど）がすべて消えます。キャラの名前と見た目は残ります。`,
    '最後の確認です。消した記録は元に戻せません。本当に消しますか？',
  ]
  const ALL_LABEL = ['このキャラの記録をぜんぶ消す', 'それでも消す', '完全に消す']

  function removeWord() {
    if (!target) return
    savePlayerData(player.id, clearWord(save, target.id))
    sfx.tap()
    setNotice(`「${target.a}」の記録を消しました`)
    setTarget(null)
  }

  function removeAll() {
    if (step < 2) {
      sfx.boing()
      setStep(step + 1)
      return
    }
    savePlayerData(player.id, clearAll())
    sfx.tap()
    setStep(0)
    setTarget(null)
    setNotice('このキャラの記録をすべて消しました')
  }

  const stat = (label: string, value: number, key: string) => (
    <div className="pstat" data-stat={key}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )

  return (
    <div className="screen settings parent">
      <h1 className="settings-title">おうちのかた</h1>

      <section className="settings-card parent-card" data-sec="summary">
        <h2 className="settings-label">📊 このキャラの記録</h2>
        <div className="parent-who" style={{ '--theme': player.color } as React.CSSProperties}>
          <PixelMonkey char={player.char} mood="happy" size={40} anim="idle" />
          <span className="player-plate">{player.name}</span>
        </div>
        <div className="pstat-grid">
          {stat('遊んだ日数', sum.days, 'days')}
          {stat('遊んだ回数', sum.plays, 'plays')}
          {stat('おぼえた単語', sum.learned, 'learned')}
          {stat('☆の合計', sum.stars, 'stars')}
          {stat('くもりの数', sum.cloudy, 'cloudy')}
          {stat('合計の正解数', sum.correct, 'correct')}
        </div>
        <h3 className="parent-sub">最近7日に遊んだ回数</h3>
        <div className="week-bars">
          {week.map((d) => (
            <div key={d.day} className="week-row" data-day={d.day}>
              <span className="wk-day">{dayLabel(d.day)}</span>
              <span className="wk-bar">
                <i style={{ width: `${(d.plays / weekMax) * 100}%` }} />
              </span>
              <b className="wk-n">{d.plays}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-card parent-card" data-sec="trouble">
        <h2 className="settings-label">😣 苦手なことば</h2>
        <p className="settings-note">まちがえた回数が多い順（最大10語）</p>
        {trouble.length === 0 ? (
          <p className="parent-empty">まだありません</p>
        ) : (
          <ol className="trouble-list">
            {trouble.map((t) => (
              <li key={t.q.id} className="trouble-item" data-id={t.q.id}>
                <span className="tr-pic">
                  <Pic q={t.q} />
                </span>
                <span className="tr-name">{t.q.a}</span>
                <span className="tr-ok">○ {t.ok}</span>
                <span className="tr-ng">× {t.ng}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="settings-card parent-card" data-sec="clear-word">
        <h2 className="settings-label">🧹 ことばの記録を消す</h2>
        <p className="settings-note">ことばを探して選ぶと、その1語の記録（☆・くもり・ふくしゅう）を消します</p>
        <div className="pfind">
          <input className="name-input pfind-input" value={query} placeholder="ことばで探す（例：ねこ）" autoComplete="off" onChange={(e) => { setQuery(e.target.value); setTarget(null); setNotice('') }} />
          <select className="pfind-cat" value={cat} aria-label="カテゴリ" onChange={(e) => { setCat(e.target.value); setTarget(null); setNotice('') }}>
            <option value="">すべてのカテゴリ</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        {found.length === 0 ? (
          <p className="parent-empty">記録のあることばが見つかりません</p>
        ) : (
          <div className="pfind-list">
            {found.slice(0, MAX_LIST).map((q) => (
              <button key={q.id} className={`pfind-item ${target?.id === q.id ? 'is-sel' : ''}`} data-id={q.id} onClick={() => { sfx.select(); setTarget(q); setNotice('') }}>
                <span className="tr-pic">
                  <Pic q={q} />
                </span>
                <span>{q.a}</span>
              </button>
            ))}
            {found.length > MAX_LIST && <p className="parent-empty pfind-more">ほか {found.length - MAX_LIST} 語（ことばやカテゴリで絞ってください）</p>}
          </div>
        )}
        {target && (
          <div className="pconfirm">
            <p className="delete-warn step1">
              「{target.a}」の記録を消します。☆・くもり・ふくしゅうの記録もなくなります（えにっきは残ります）。
            </p>
            <button className="btn delete-btn step2 word-del" onClick={removeWord}>
              「{target.a}」の記録を消す
            </button>
            <button className="btn keep-btn word-keep" onClick={() => { sfx.tap(); setTarget(null) }}>
              やめる
            </button>
          </div>
        )}
        {notice && <p className="name-msg ok parent-notice">{notice}</p>}
      </section>

      <section className="settings-card parent-card" data-sec="clear-all">
        <h2 className="settings-label">⚠️ 記録をぜんぶ消す</h2>
        <p className="settings-note">バナナ・コースの解放・おぼえたことば・ずかん・えにっき・シールがすべて最初に戻ります。キャラの名前と見た目は残ります。</p>
        {step > 0 && (
          <p key={step} className={`delete-warn step${LOOK[step]}`} data-step={step}>
            {'⚠️'.repeat(step)} {WARN[step]}
          </p>
        )}
        <button className={`btn delete-btn all-del step${LOOK[step]}`} data-step={step} onClick={removeAll}>
          {ALL_LABEL[step]}
        </button>
        {step > 0 && (
          <button className="btn keep-btn all-keep" onClick={() => { sfx.tap(); setStep(0) }}>
            やめる
          </button>
        )}
      </section>

      <div className="settings-foot">
        <button className="btn back-btn" onClick={() => { sfx.tap(); onBack() }}>
          もどる
        </button>
      </div>
    </div>
  )
}
