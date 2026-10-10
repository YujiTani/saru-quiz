import { useMemo, useState } from 'react'
import { ShowStage } from '../components/ShowStage'
import { now } from '../lib/day'
import { savePlayerData, type Player } from '../lib/players'
import { sfx } from '../lib/sound'
import { isTestRun } from '../lib/testflags'
import { BOOK_CATS, bookCounts, isOwned, showsOf, unlockCtx, type Show, type ShowCat } from '../shows'

/**
 * えんしゅつ図鑑。上は「ためす」の舞台、その下にカテゴリのタブ・集計・カード。
 * 手に入れたものは アイコンと名前（タップで ためす）。まだのものは 黒い影と「？？？」で、解放条件は親向けの小さな文字（読み上げない）
 */
export function ShowBook({ player, onBack }: { player: Player; onBack: () => void }) {
  const { save } = player
  const u = useMemo(() => unlockCtx(save, now()), [save])
  const counts = useMemo(() => bookCounts(u, save.shows.got), [u, save.shows.got])
  const [cat, setCat] = useState<ShowCat>('ugoku')
  const [sel, setSel] = useState<Show | null>(null)
  const [run, setRun] = useState(0)

  const list = showsOf(cat)
  const label = BOOK_CATS.find((c) => c.cat === cat)?.label ?? ''
  const pick = save.shows.pick[cat]
  const owned = (s: Show) => isOwned(s, u, save.shows.got)
  const found = (s: Show) => s.cat === 'happening' && owned(s) // ハプニングは「みつけた！」

  function tryShow(s: Show) {
    if (!owned(s)) return void sfx.boing() // まだのものは影のまま。読み上げもしない
    sfx.tap()
    setSel(s)
    setRun((n) => n + 1)
  }

  function chooseTab(c: ShowCat, el: HTMLElement) {
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) // 横に長いタブの列で、選んだタブを見える所へ
    if (c === cat) return
    sfx.select()
    setCat(c)
    setSel(null)
  }

  /** 「こてい」⇄「おまかせ」。うごくえは カテゴリごとに自動で決まるので固定しない */
  function togglePin(s: Show) {
    sfx.select()
    const next = pick === s.id ? 'auto' : s.id
    if (isTestRun()) return
    savePlayerData(player.id, { ...save, shows: { ...save.shows, pick: { ...save.shows.pick, [s.cat]: next } } })
  }

  const canPin = !!sel && sel.cat === cat && cat !== 'ugoku' && cat !== 'happening' && owned(sel)
  const pinned = !!sel && pick === sel.id

  return (
    <div className="screen book">
      <ShowStage show={sel} run={run} className="book-stage" />

      <div className="book-tabs" role="tablist">
        {BOOK_CATS.map((c) => {
          const n = counts.byCat[c.cat]
          return (
            <button key={c.cat} role="tab" aria-selected={c.cat === cat} className={`book-tab ${c.cat === cat ? 'is-on' : ''} ${n.total === 0 ? 'is-soon' : ''}`} data-cat={c.cat} onClick={(e) => chooseTab(c.cat, e.currentTarget)}>
              <span className="tab-icon">{c.icon}</span>
              <span className="tab-label">{c.label}</span>
              <small className="tab-n">{n.total === 0 ? 'もうすぐ' : `${n.got}/${n.total}`}</small>
            </button>
          )
        })}
      </div>

      <div className="book-sum">
        <span>
          ぜんぶで <b className="sum-all">{counts.all.got}</b> / {counts.all.total}
        </span>
        <span className="sum-cat">
          {label} <b>{counts.byCat[cat].got}</b> / {counts.byCat[cat].total}
        </span>
      </div>

      {canPin && sel ? (
        <div className="book-pin">
          <span className="pin-name">
            {sel.icon} {sel.name}
          </span>
          <button className={`btn pin-btn ${pinned ? 'is-on' : ''}`} onClick={() => togglePin(sel)}>
            {pinned ? '🔄 おまかせに もどす' : '📌 こてい'}
          </button>
        </div>
      ) : (
        <div className="book-pin is-empty">{cat === 'ugoku' ? 'おぼえた ことばで じどうで つかわれるよ' : sel ? `${sel.icon} ${sel.name}` : ''}</div>
      )}

      {list.length === 0 ? (
        <div className="book-soon">
          <span className="soon-icon">🎁</span>
          もうすぐ
        </div>
      ) : (
        <div className="book-grid">
          {list.map((s) => {
            const own = owned(s)
            const picked = !!pick && pick !== 'auto' && pick === s.id && s.cat !== 'ugoku'
            return (
              <button key={s.id} className={`book-card ${own ? 'own' : 'locked'} ${sel?.id === s.id ? 'is-sel' : ''} ${picked ? 'is-picked' : ''}`} data-id={s.id} onClick={() => tryShow(s)}>
                <span className="card-icon">{s.icon}</span>
                <span className="card-name">{own ? s.name : '？？？'}</span>
                {!own && s.hint && <small className="card-hint">{s.hint}</small>}
                {picked && <span className="card-mark">えらんでる</span>}
                {found(s) && <span className="card-mark found">みつけた！</span>}
              </button>
            )
          })}
        </div>
      )}

      <button className="btn book-back" onClick={() => { sfx.tap(); onBack() }}>
        もどる
      </button>
    </div>
  )
}
