import { useEffect, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { getCurrent } from '../lib/players'
import { getVoice, getVolume, isMuted, onSettingsChange, setMuted, setVoice, setVolume, VOICES, type VoiceId } from '../lib/settings'
import { sfx } from '../lib/sound'
import { speak, stopSpeaking } from '../lib/speech'

/** せってい画面（キャラ・こえ・おと・おんりょう）。音の設定は子どもが押さないようにここだけに置く */
export function Settings({ onBack, onEditPlayer }: { onBack: () => void; onEditPlayer: () => void }) {
  const player = getCurrent()
  const [voice, setVoiceState] = useState<VoiceId>(getVoice)
  const [muted, setMutedState] = useState(isMuted)
  const [volume, setVolumeState] = useState(getVolume)

  useEffect(
    () =>
      onSettingsChange(() => {
        setVoiceState(getVoice())
        setMutedState(isMuted())
        setVolumeState(getVolume())
      }),
    [],
  )

  function chooseVoice(id: VoiceId) {
    setVoice(id)
    sfx.select()
    stopSpeaking()
    void speak('これ、なあに？')
  }

  return (
    <div className="screen settings">
      <h1 className="settings-title">せってい</h1>

      {player && (
        <section className="settings-card">
          <h2 className="settings-label">🐵 キャラ</h2>
          <div className="settings-player" style={{ '--theme': player.color } as React.CSSProperties}>
            <PixelMonkey char={player.char} mood="happy" size={52} anim="idle" />
            <span className="player-plate">{player.name}</span>
            <button className="btn edit-player-btn" onClick={() => { sfx.tap(); onEditPlayer() }}>
              なおす
            </button>
          </div>
          <p className="settings-note">なまえ・みため・いろ を かえられるよ</p>
        </section>
      )}

      <section className="settings-card">
        <h2 className="settings-label">🗣️ こえ</h2>
        <div className="voice-options">
          {VOICES.map((v) => (
            <button key={v.id} className={`btn voice-btn ${voice === v.id ? 'is-on' : ''}`} onClick={() => chooseVoice(v.id)} aria-pressed={voice === v.id}>
              {v.name}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-label">🔊 おと</h2>
        <div className="sound-row">
          <button className={`btn sound-btn ${!muted ? 'is-on' : ''}`} onClick={() => { setMuted(false); sfx.select() }} aria-pressed={!muted}>
            あり
          </button>
          <button className={`btn sound-btn ${muted ? 'is-on' : ''}`} onClick={() => setMuted(true)} aria-pressed={muted}>
            なし
          </button>
        </div>
        <label className="volume-row">
          <span>🔈</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(volume * 100)}
            disabled={muted}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            onPointerUp={() => sfx.coin()}
            aria-label="おんりょう"
          />
          <span>🔊</span>
        </label>
      </section>

      <div className="settings-foot">
        <PixelMonkey char="monchan" mood="happy" size={44} anim="idle" />
        <button className="btn back-btn" onClick={() => { sfx.tap(); onBack() }}>
          もどる
        </button>
      </div>
    </div>
  )
}
