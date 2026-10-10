import { useEffect, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { checkName, getPlayerName, getVoice, getVolume, isMuted, onSettingsChange, setMuted, setPlayerName, setVoice, setVolume, VOICES, type VoiceId } from '../lib/settings'
import { sfx } from '../lib/sound'
import { speak, stopSpeaking } from '../lib/speech'

/** せってい画面（なまえ・こえ・おと・おんりょう）。音の設定は子どもが押さないようにここだけに置く */
export function Settings({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState(getPlayerName)
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)
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

  // 入力中（変換中）ははじかず、「きめる」で確かめる（iPhone のかな入力を邪魔しないため）
  function saveName() {
    const v = name.trim()
    const err = checkName(v)
    if (err) {
      sfx.boing()
      setNameMsg({ ok: false, text: err })
      return
    }
    setPlayerName(v)
    sfx.select()
    setNameMsg({ ok: true, text: `「${v}」に したよ！` })
  }

  function chooseVoice(id: VoiceId) {
    setVoice(id)
    sfx.select()
    stopSpeaking()
    void speak('これ、なあに？')
  }

  return (
    <div className="screen settings">
      <h1 className="settings-title">せってい</h1>

      <section className="settings-card">
        <h2 className="settings-label">🏷️ なまえ</h2>
        <p className="settings-note">ランキングに のるよ（ひらがな 8もじまで）</p>
        <div className="name-row">
          <input
            className="name-input"
            value={name}
            maxLength={8}
            inputMode="text"
            autoComplete="off"
            placeholder="れい：ゆうちゃん"
            onChange={(e) => {
              setName(e.target.value)
              setNameMsg(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
          <button className="btn name-save" onClick={saveName}>
            きめる
          </button>
        </div>
        {nameMsg && <p className={`name-msg ${nameMsg.ok ? 'ok' : 'ng'}`}>{nameMsg.text}</p>}
      </section>

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
