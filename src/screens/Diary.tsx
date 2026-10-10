import { useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { Sticker } from '../components/Sticker'
import { WordTile } from '../components/WordTile'
import { addMonth, cmpMonth, dayKeyOf, fmtDay, monthCells, type YM } from '../lib/calendar'
import { dayKey, now } from '../lib/day'
import type { Player } from '../lib/players'
import { questionById } from '../lib/quiz'
import { MONKEY_SLOT, PHOTO_MAX, riserLayout } from '../lib/riser'
import { sfx } from '../lib/sound'
import { speak } from '../lib/speech'
import type { DiaryDay } from '../lib/storage'
import { spriteUrl } from '../sprites/monkeys'

const DOW = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど']
/** どこまで前の月に戻れるか（今の月から数えて） */
const BACK_MONTHS = 12

/** 絵（なければ絵文字） */
function Art({ id }: { id: string }) {
  const q = questionById(id)
  if (!q) return null
  return q.img ? <img src={q.img} alt="" draggable={false} /> : <span className="emoji">{q.e}</span>
}

/** その日の しゃしん。きねんしゃしんと同じひな壇に、おさると ことばを並べる（保存は id だけ。毎回ここで組み立てる） */
function DayPhoto({ day, dateKey, char }: { day: DiaryDay; dateKey: string; char: Player['char'] }) {
  const words = day.words.slice(-PHOTO_MAX)
  const slots = riserLayout(words.length)
  const mastered = new Set(day.mastered ?? [])
  const box = (s: { x: number; y: number; size: number }) => ({ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.size * 100}%` })
  return (
    <div className="photo-card still">
      <div className="photo-pic">
        <div className="photo-step s1" />
        <div className="photo-step s2" />
        <div className="photo-step s3" />
        {words.map((id, i) => {
          const q = questionById(id)
          return q ? (
            <button key={id} className="photo-word" style={box(slots[i])} onClick={() => { sfx.tap(); void speak(q.a) }} aria-label={q.a}>
              <Art id={id} />
              {mastered.has(id) && <span className="photo-star">☆</span>}
            </button>
          ) : null
        })}
        <img className="photo-monkey pixel" src={spriteUrl(char, 'happy')} alt="" draggable={false} style={box(MONKEY_SLOT)} />
      </div>
      <div className="photo-frame">
        <div className="photo-cap">{fmtDay(dateKey)}</div>
        <div className="photo-tape t1" />
        <div className="photo-tape t2" />
      </div>
    </div>
  )
}

/** えにっき。月のページ（カレンダー）→ 日をタップすると その日の絵日記 */
export function Diary({ player }: { player: Player }) {
  const { diary, stickers } = player.save
  const today = dayKey(now())
  const cur: YM = { y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }
  const [ym, setYm] = useState<YM>(cur)
  const [open, setOpen] = useState<string | null>(null)
  const move = (d: number) => {
    sfx.tap()
    setYm(addMonth(ym, d))
  }

  if (open && diary[open]) {
    const day = diary[open]
    const mastered = new Set(day.mastered ?? [])
    // ぜんぶの ことば（☆1になった日のものに ☆）。写真にのらなかった分も ここで見られる
    const all = [...day.words, ...(day.mastered ?? []).filter((id) => !day.words.includes(id))]
    return (
      <div className="screen diary diary-day">
        <div className="diary-bar">
          <button className="btn diary-back" onClick={() => { sfx.tap(); setOpen(null) }}>
            ◀ えにっき
          </button>
        </div>
        <h2 className="diary-date">{fmtDay(open)}</h2>
        <DayPhoto day={day} dateKey={open} char={player.char} />
        <div className="diary-stats">
          <span>
            あそんだ <b>{day.plays}</b> かい
          </span>
          {day.sticker !== undefined && (
            <span className="diary-sticker">
              シール <Sticker kind={day.sticker} size={44} />
            </span>
          )}
        </div>
        {all.length > 0 && (
          <div className="diary-words">
            <div className="diary-words-title">この日の ことば</div>
            <div className="learn-row">
              {all.map((id) => (
                <WordTile key={id} id={id} badge={mastered.has(id) ? '☆' : ''} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const cells = monthCells(ym.y, ym.m)
  const canPrev = cmpMonth(ym, addMonth(cur, -BACK_MONTHS)) > 0
  const canNext = cmpMonth(ym, cur) < 0 // 今日より先の月には行かない
  return (
    <div className="screen diary">
      <div className="diary-head">
        <button className="btn diary-nav prev" disabled={!canPrev} onClick={() => move(-1)} aria-label="まえの つき">
          ◀
        </button>
        <h2 className="diary-month">
          {ym.y}ねん {ym.m}がつ
        </h2>
        <button className="btn diary-nav next" disabled={!canNext} onClick={() => move(1)} aria-label="つぎの つき">
          ▶
        </button>
      </div>
      <div className="diary-dow">
        {DOW.map((d, i) => (
          <span key={d} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>
            {d}
          </span>
        ))}
      </div>
      <div className="diary-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="diary-cell blank" />
          const key = dayKeyOf(ym.y, ym.m, d)
          const day = diary[key]
          const cls = `diary-cell ${key === today ? 'today' : ''}`
          // 遊んでいない日は白いまま（何も描かない）
          if (!day) return (
            <span key={i} className={cls}>
              <span className="n">{d}</span>
            </span>
          )
          const last = day.words[day.words.length - 1]
          return (
            <button key={i} className={`${cls} played`} onClick={() => { sfx.select(); setOpen(key) }} aria-label={`${ym.m}がつ${d}にち`}>
              <span className="n">{d}</span>
              {day.sticker !== undefined && <Sticker kind={day.sticker} size={30} className="cell-sticker" />}
              {last && (
                <span className="cell-word">
                  <Art id={last} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="diary-foot">
        <PixelMonkey char={player.char} mood="happy" size={44} anim="idle" />
        <span>
          シール <b>{stickers}</b> まい
        </span>
      </div>
    </div>
  )
}
