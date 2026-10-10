// 日本語の読み上げ（端末の標準合成音声）。のちに親の録音で差し替える予定
import voices from '../data/voices.json'
import { getVolume, isMuted, onSettingsChange } from './settings'
import { playVoice, preloadVoice, stopVoice } from './sound'

// VOICEVOX（ずんだもん）で作った音声。無いセリフは端末の合成音声で読む
const VOICE: Record<string, string> = voices
export const hasVoice = (text: string) => text in VOICE
export function preloadSpeech(texts: string[]) {
  for (const t of texts) if (VOICE[t]) preloadVoice(VOICE[t])
}

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

onSettingsChange(() => isMuted() && stopSpeaking())

let speakToken = 0

export function stopSpeaking() {
  speakToken++
  stopVoice()
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

/** 読み終わったら resolve。配列なら順番に読む（例: ['せいかい！', 'りんご']） */
export async function speak(text: string | string[], opts?: { rate?: number; pitch?: number }): Promise<void> {
  const parts = Array.isArray(text) ? text : [text]
  const my = ++speakToken
  for (const part of parts) {
    if (my !== speakToken) return
    if (!isMuted() && VOICE[part] && (await playVoice(VOICE[part]))) continue
    if (my !== speakToken) return
    await speakTTS(part, opts)
  }
}

/** 端末の合成音声。端末によって onend が来ないことがあるので時間で打ち切る */
function speakTTS(text: string, { rate = 0.95, pitch = 1.08 } = {}): Promise<void> {
  // ミュート中も画面の進行テンポは保つため、読み上げ相当の時間だけ待つ
  if (isMuted() || !('speechSynthesis' in window)) return new Promise((r) => setTimeout(r, 300 + text.length * 120))
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ja-JP'
    u.volume = getVolume()
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
