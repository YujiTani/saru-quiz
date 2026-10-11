// おうえん: 絵のカードのふちに出る観客（おさるおうえんだん / ことりのコーラス）
// .picture-wrap の中に置く。カードの左右のふち・カードの上の電線にだけ出るので、選択肢のボタンや 画面下の .reach-crowd とは重ならない
// 動きの強さ 0 のときは、跳ねたり飛んだりせず 並ぶだけ
import { BIRD_MAX, birdCount, cheerSlot, osaruCount } from '../shows/ouen'
import type { CharId } from '../sprites/monkeys'
import { PixelMonkey } from './PixelMonkey'

export type CheerProps = {
  /** 'ouen:osaru' | 'ouen:kotori' */
  id: string
  /** クリアまでの進み具合 0〜1 */
  E: number
  motion: number
  /** 正解の数。ことり用 */
  correct: number
}

const MONKEYS: CharId[] = ['monchan', 'sora', 'mint', 'choco', 'mandrill', 'orangutan', 'kinshikou', 'rainbow', 'gorilla']
const FLAGS = ['#ff4f9a', '#38b6ff', '#3ee07a', '#ffd400', '#a066ff', '#ff8a1c']
const BIRDS = ['🐤', '🐦', '🐥', '🕊️', '🦜']

// 観客はカードのふちから少しはみ出す。画面の左右の余白（16px）より外には出ない（どの画面幅でも切れない）
const slotStyle = (k: number): React.CSSProperties => {
  const s = cheerSlot(k)
  return { top: `${s.y}cqh`, [s.side]: 'max(calc(var(--s) * -0.62), -12px)' }
}

export function Cheer({ id, E, motion, correct }: CheerProps) {
  const still = motion <= 0
  const hop = 3 + 8 * E // E が上がるほど高く跳ねる
  const kind = id.replace('ouen:', '')

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

  // おさるおうえんだん（ほかの id でも、これを出す）
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
