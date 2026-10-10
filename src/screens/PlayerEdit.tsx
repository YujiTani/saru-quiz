import { useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { addPlayer, CHARS, COLORS, deletePlayer, getPlayers, updatePlayer, type Player } from '../lib/players'
import { checkName } from '../lib/settings'
import { sfx } from '../lib/sound'
import { speak, stopSpeaking } from '../lib/speech'
import type { CharId } from '../sprites/monkeys'

type Props = {
  /** なしなら新しく作る */
  player?: Player
  /** はじめて遊ぶとき（もどるボタンを出さない） */
  first?: boolean
  onDone: () => void
  onBack?: () => void
}

/** キャラをつくる / なおす（なまえ・見た目9しゅるい・色） */
export function PlayerEdit({ player, first = false, onDone, onBack }: Props) {
  const [name, setName] = useState(player?.name ?? '')
  const [char, setChar] = useState<CharId>(player?.char ?? 'monchan')
  const [color, setColor] = useState(player?.color ?? COLORS[getPlayers().length % COLORS.length])
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 入力中（変換中）ははじかず、「けってい」で確かめる（iPhone のかな入力を邪魔しないため）
  function decide() {
    const v = name.trim()
    const err = checkName(v)
    if (err) {
      sfx.boing()
      setMsg(err)
      return
    }
    if (player) updatePlayer(player.id, { name: v, char, color })
    else addPlayer({ name: v, char, color })
    sfx.fanfare()
    void speak(`${v}、よろしくね！`)
    onDone()
  }

  function pickChar(id: CharId) {
    setChar(id)
    sfx.select()
    stopSpeaking()
    void speak(CHARS.find((c) => c.id === id)?.name ?? '')
  }

  function remove() {
    if (!player) return
    if (!confirmDelete) {
      sfx.boing()
      setConfirmDelete(true)
      return
    }
    deletePlayer(player.id)
    sfx.tap()
    onDone()
  }

  return (
    <div className="screen player-edit" style={{ '--theme': color } as React.CSSProperties}>
      <h1 className="settings-title">{player ? 'キャラを なおす' : first ? 'キャラを つくろう！' : 'あたらしい キャラ'}</h1>

      <div className="player-preview">
        <PixelMonkey char={char} mood="happy" size={72} anim="jump" />
        <span className="player-plate">{name.trim() || 'なまえ'}</span>
      </div>

      <section className="settings-card">
        <h2 className="settings-label">🏷️ なまえ</h2>
        <p className="settings-note">ランキングに のるよ（ひらがな 8もじまで）</p>
        <input
          className="name-input"
          value={name}
          maxLength={8}
          inputMode="text"
          autoComplete="off"
          placeholder="れい：ゆうちゃん"
          onChange={(e) => {
            setName(e.target.value)
            setMsg(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {msg && <p className="name-msg ng">{msg}</p>}
      </section>

      <section className="settings-card">
        <h2 className="settings-label">🐵 みため</h2>
        <div className="char-grid">
          {CHARS.map((c) => (
            <button key={c.id} className={`char-btn ${char === c.id ? 'is-on' : ''}`} onClick={() => pickChar(c.id)} aria-label={c.name} aria-pressed={char === c.id}>
              <PixelMonkey char={c.id} size={44} anim={char === c.id ? 'dance' : 'none'} />
            </button>
          ))}
        </div>
        <h2 className="settings-label">🎨 いろ</h2>
        <div className="color-row">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-btn ${color === c ? 'is-on' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setColor(c)
                sfx.select()
              }}
              aria-label="いろ"
              aria-pressed={color === c}
            />
          ))}
        </div>
      </section>

      <button className="btn name-save" onClick={decide}>
        けってい！
      </button>
      <div className="settings-foot">
        {player && getPlayers().length > 1 && (
          <button className={`btn delete-btn ${confirmDelete ? 'is-confirm' : ''}`} onClick={remove}>
            {confirmDelete ? 'ほんとうに けす？（もういちど おす）' : 'このキャラを けす'}
          </button>
        )}
        {!first && onBack && (
          <button className="btn back-btn" onClick={() => { sfx.tap(); onBack() }}>
            もどる
          </button>
        )}
      </div>
    </div>
  )
}
