import { useMemo, useState } from 'react'
import { ShowStage } from '../components/ShowStage'
import { now } from '../lib/day'
import type { Player } from '../lib/players'
import { canPractice, categories, type Question } from '../lib/quiz'
import { sfx } from '../lib/sound'
import { speak, stopSpeaking } from '../lib/speech'
import { bookTotals, cardsOf, catCounts, type WordCard } from '../lib/wordbook'
import { ugokuFor, unlockCtx } from '../shows'

// まだ なにも えらんでいないときの舞台の絵（「これ なあに？」と聞くだけ）
const BLANK: Question = { id: '', a: '', c: '', l: 1, e: '❓' }

/**
 * ことば図鑑。上は 全体の集計と、さわった単語の「うごくえ」の舞台。下にカテゴリのタブ（おぼえた数/出題できる数）とカード。
 * 出た単語は 絵・名前・☆（くもりは雲もよう）で、さわると読み上げて うごくえを見せる。まだの単語は 影と「？」（答えは見せない）
 */
export function WordBook({ player, initialCat, onPractice, onBack }: { player: Player; initialCat?: string; onPractice: (cat: string) => void; onBack: () => void }) {
  const { save } = player
  const nowMs = now()
  const counts = useMemo(() => catCounts(save.stats), [save.stats])
  const totals = useMemo(() => bookTotals(save.stats), [save.stats])
  const u = useMemo(() => unlockCtx(save, nowMs), [save, nowMs])
  // はじめに開くカテゴリ: 指定があればそれ、なければ 出た単語がいちばん多いカテゴリ（どれもなければ先頭）
  const [cat, setCat] = useState(() => (initialCat && categories.some((c) => c.name === initialCat) ? initialCat : counts.reduce((best, c) => (c.seen > best.seen ? c : best), counts[0]).name))
  const [sel, setSel] = useState<Question | null>(null)
  const [run, setRun] = useState(0)
  const cards = useMemo(() => cardsOf(cat, save.stats, nowMs), [cat, save.stats, nowMs])
  const here = counts.find((c) => c.name === cat)
  const show = sel ? ugokuFor(sel.c, u) : null

  function tapCard(c: WordCard) {
    if (!c.seen) return void sfx.boing() // まだの単語は影のまま。読み上げもしない（答えを見せない）
    sfx.tap()
    stopSpeaking()
    void speak(c.q.a)
    setSel(c.q)
    setRun((n) => n + 1)
  }

  function chooseTab(name: string, el: HTMLElement) {
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) // 横に長いタブの列で、選んだタブを見える所へ
    if (name === cat) return
    sfx.select()
    setCat(name)
    setSel(null)
  }

  return (
    <div className="screen book words">
      <div className="word-total">
        <span>
          おぼえた ことば <b className="wt-learned">{totals.learned}</b> / {totals.total}
        </span>
        <span>
          ☆ <b className="wt-stars">{totals.stars}</b>
        </span>
      </div>

      <ShowStage show={show} run={run} word={sel ?? BLANK} className="book-stage word-stage" />

      <div className="book-tabs word-tabs" role="tablist">
        {counts.map((c) => (
          <button key={c.name} role="tab" aria-selected={c.name === cat} className={`book-tab ${c.name === cat ? 'is-on' : ''}`} data-cat={c.name} onClick={(e) => chooseTab(c.name, e.currentTarget)}>
            <span className="tab-icon">{c.icon}</span>
            <span className="tab-label">{c.name}</span>
            <small className="tab-n">
              {c.learned}/{c.total}
            </small>
          </button>
        ))}
      </div>

      <div className="word-head">
        <span className="wh-cat">
          {here?.icon} <b>{here?.learned ?? 0}</b> / {here?.total ?? 0}
        </span>
        {canPractice(cat) && (
          <button className="btn practice-btn" onClick={() => { sfx.tap(); onPractice(cat) }}>
            ✏️ このカテゴリを れんしゅう
          </button>
        )}
      </div>

      <div className="word-grid">
        {cards.map((c) => (
          <button key={c.q.id} className={`word-card ${c.seen ? 'own' : 'locked'} ${c.cloudy ? 'is-cloudy' : ''} ${sel?.id === c.q.id ? 'is-sel' : ''}`} data-id={c.q.id} onClick={() => tapCard(c)} aria-label={c.seen ? c.q.a : 'まだ でていない ことば'}>
            <span className={`wc-pic ${c.cloudy ? 'is-cloudy' : ''}`}>{c.q.img ? <img src={c.q.img} alt="" draggable={false} /> : <span className="emoji">{c.q.e}</span>}</span>
            <span className="wc-name">{c.seen ? c.q.a : '？'}</span>
            <span className="wc-stars">{c.seen ? '☆'.repeat(c.stars) : ''}</span>
          </button>
        ))}
      </div>

      <button className="btn book-back" onClick={() => { sfx.tap(); onBack() }}>
        もどる
      </button>
    </div>
  )
}
