// 日本語の読み上げ（端末の標準合成音声）。のちに親の録音で差し替える予定
import { isMuted, onMutedChange } from './settings'

let voice: SpeechSynthesisVoice | null = null

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ja'))
  // iOS では Kyoko / O-ren などが入っている。拡張(高品質)版があれば優先
  voice = voices.find((v) => /enhanced|premium|拡張/i.test(v.name)) ?? voices.find((v) => /kyoko|o-ren/i.test(v.name)) ?? voices[0] ?? null
}

if ('speechSynthesis' in window) {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

/** iOS はユーザー操作中に一度話させないと以後しゃべらないので、最初のタップで呼ぶ */
export function unlockSpeech() {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance('')
  u.volume = 0
  speechSynthesis.speak(u)
}

onMutedChange((m) => m && stopSpeaking())

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

/** 読み終わったら resolve。端末によって onend が来ないことがあるので時間で打ち切る */
export function speak(text: string, { rate = 0.9, pitch = 1.25 } = {}): Promise<void> {
  // ミュート中も画面の進行テンポは保つため、読み上げ相当の時間だけ待つ
  if (isMuted() || !('speechSynthesis' in window)) return new Promise((r) => setTimeout(r, 300 + text.length * 120))
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ja-JP'
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = pitch
    const timer = setTimeout(resolve, 600 + text.length * 260)
    u.onend = u.onerror = () => {
      clearTimeout(timer)
      resolve()
    }
    speechSynthesis.speak(u)
  })
}
