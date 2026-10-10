// おうえん: 絵のカードのふちに出る観客（きょうのなかま / おさるおうえんだん / ことりのコーラス）
// .picture-wrap の中に置く。カードの左右のふち・カードの上の電線にだけ出るので、選択肢のボタンや 画面下の .reach-crowd とは重ならない
// 動きの強さ 0 のときは、跳ねたり飛んだりせず 並ぶだけ
import { useLayoutEffect, useRef } from 'react'
import type { Question } from '../lib/quiz'
import { BIRD_MAX, birdCount, cheerSlot, nakamaItems, osaruCount } from '../shows/ouen'
import type { CharId } from '../sprites/monkeys'
import { PixelMonkey } from './PixelMonkey'

export type CheerProps = {
  /** 'ouen:nakama' | 'ouen:osaru' | 'ouen:kotori' */
  id: string
  /** クリアまでの進み具合 0〜1 */
  E: number
  motion: number
  /** このプレイで正解した単語（重複なし。新しいほうが後ろ）。なかま用 */
  words: Question[]
  /** 正解の数。ことり用 */
  correct: number
}

const MONKEYS: CharId[] = ['monchan', 'sora', 'mint', 'choco', 'mandrill', 'orangutan', 'kinshikou', 'rainbow', 'gorilla']
const FLAGS = ['#ff4f9a', '#38b6ff', '#3ee07a', '#ffd400', '#a066ff', '#ff8a1c']
const BIRDS = ['🐤', '🐦', '🐥', '🕊️', '🦜']

const slotStyle = (k: number): React.CSSProperties => {
  const s = cheerSlot(k)
  return { top: `${s.y}cqh`, [s.side]: 'calc(var(--s) * -0.62)' }
}

/** 正解した絵が、カードの真ん中から ふちの置き場所へ飛んでくる（最初に置かれたときだけ） */
function Tile({ q, slot, fresh, hop, still, delay }: { q: Question; slot: number; fresh: boolean; hop: number; still: boolean; delay: number }) {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const e = el.current
    const wrap = e?.parentElement
    if (!e || !wrap || !fresh) return
    const a = e.getBoundingClientRect()
    const b = wrap.getBoundingClientRect()
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - (a.top + a.height / 2)
    const anim = e.animate([{ transform: `translate(${dx}px, ${dy}px) scale(5)`, opacity: 1 }, { transform: 'translate(0, 0) scale(1.25)', opacity: 1, offset: 0.8 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.3,.7,.4,1)' })
    return () => anim.cancel()
  }, [fresh])
  return (
    <div ref={el} className="cheer-item" style={slotStyle(slot)} data-slot={slot}>
      <div className={`cheer-tile ${still ? '' : 'hop'}`} style={{ '--hop': `${hop}px`, animationDelay: `${delay}s` } as React.CSSProperties}>
        {q.img ? <img src={q.img} alt="" draggable={false} /> : <span className="emoji">{q.e}</span>}
      </div>
    </div>
  )
}

export function Cheer({ id, E, motion, words, correct }: CheerProps) {
  const still = motion <= 0
  const hop = 3 + 8 * E // E が上がるほど高く跳ねる
  const initial = useRef<number | null>(null)
  if (initial.current === null) initial.current = words.length
  const kind = id.replace('ouen:', '')

  if (kind === 'osaru') {
    const n = osaruCount(E)
    return (
      <div className={`cheer cheer-osaru ${still ? 'still' : ''}`} data-ouen="osaru" data-n={n} aria-hidden>
        {Array.from({ length: n }, (_, k) => (
          <div key={k} className="cheer-item" style={slotStyle(k)}>
            <div className={`cheer-mk ${still ? '' : 'hop'}`} style={{ '--hop': `${hop}px`, animationDelay: `${(k % 5) * 0.11}s` } as React.CSSProperties}>
              <PixelMonkey char={MONKEYS[k % MONKEYS.length]} mood="happy" size={30} anim="none" />
              <span className={`cheer-flag ${still ? '' : 'wave'}`} style={{ '--fc': FLAGS[k % FLAGS.length], animationDelay: `${(k % 4) * 0.2}s` } as React.CSSProperties} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (kind === 'kotori') {
    const n = birdCount(correct)
    return (
      <div className={`cheer cheer-kotori ${still ? 'still' : ''}`} data-ouen="kotori" data-n={n} aria-hidden>
        <div className="cheer-wire">
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
            <path d="M0 3 Q50 9 100 3" fill="none" stroke="#2b1a2e" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          </svg>
          {Array.from({ length: Math.min(n, BIRD_MAX) }, (_, k) => (
            <span key={k} className={`cheer-bird ${still ? '' : k === n - 1 ? 'land' : 'sway'}`} style={{ left: `${6 + k * 20}%`, animationDelay: `${k * 0.15}s` }}>
              {BIRDS[k % BIRDS.length]}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // きょうのなかま
  const items = nakamaItems(words)
  return (
    <div className={`cheer cheer-nakama ${still ? 'still' : ''}`} data-ouen="nakama" data-n={items.length} aria-hidden>
      {items.map(({ word, index, slot }) => (
        <Tile key={`${word.id}-${index}`} q={word} slot={slot} fresh={!still && index >= (initial.current ?? 0)} hop={hop} still={still} delay={(slot % 6) * 0.13} />
      ))}
    </div>
  )
}
