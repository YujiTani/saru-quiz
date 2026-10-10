import { useEffect, useState } from 'react'
import { isMuted, onMutedChange, setMuted } from '../lib/settings'

/** どの画面でも右下に出るミュート切り替え */
export function MuteButton() {
  const [muted, set] = useState(isMuted)
  useEffect(() => {
    const off = onMutedChange(set)
    return () => {
      off()
    }
  }, [])
  return (
    <button className={`mute-btn ${muted ? 'is-muted' : ''}`} onClick={() => setMuted(!muted)} aria-label={muted ? 'おとをだす' : 'おとをけす'}>
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
