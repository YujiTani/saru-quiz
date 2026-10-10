import { questionById } from '../lib/quiz'
import { speak } from '../lib/speech'
import { sfx } from '../lib/sound'

/** 単語の絵（なければ絵文字）。さわると読み上げる。badge は絵のすみに付く ☆ など（空なら付けない） */
export function WordTile({ id, badge = '' }: { id: string; badge?: string }) {
  const q = questionById(id)
  if (!q) return null
  return (
    <button className="word-tile" onClick={() => { sfx.tap(); void speak(q.a) }} aria-label={q.a}>
      {q.img ? <img src={q.img} alt="" draggable={false} /> : <span className="emoji">{q.e}</span>}
      {badge && <span className="badge">{badge}</span>}
    </button>
  )
}
