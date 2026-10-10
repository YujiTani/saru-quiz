// 読み上げ。VOICEVOX で作った声（設定で選んだ1人）を鳴らし、無いセリフは端末の合成音声で読む
import { getVoice, getVolume, isMuted, onSettingsChange, type VoiceId } from './settings'
import { duckBgm, playVoice, preloadVoice, stopVoice } from './sound'

// 声ごとのセリフ一覧（テキスト → mp3 のパス）。選んだ声のぶんだけ読み込む
const manifests = import.meta.glob<Record<string, string>>('../data/voices/*.json', { import: 'default' })
let VOICE: Record<string, string> = {}
let loadedVoice: VoiceId | null = null
let ready: Promise<void> = Promise.resolve()

function loadVoice(id: VoiceId) {
  if (loadedVoice === id) return ready
  loadedVoice = id
  const load = manifests[`../data/voices/${id}.json`] ?? manifests['../data/voices/zundamon.json']
  ready = load().then((m) => {
    if (loadedVoice === id) VOICE = m
    warmCache(id, m)
  })
  return ready
}

// オフラインでも鳴るように、選んだ声のファイルを裏で少しずつ取っておく（Service Worker がキャッシュする）。
// 取り終わった声は記録して、次からはやらない
let warmToken = 0
function warmCache(id: VoiceId, m: Record<string, string>) {
  const urls = Object.values(m)
  const key = `saru-quiz/warm/${id}/${urls.length}`
  try {
    if (localStorage.getItem(key)) return
  } catch {
    // 記録できない環境では毎回取る
  }
  const my = ++warmToken
  let i = 0
  let failed = false
  const worker = async () => {
    while (my === warmToken && i < urls.length) {
      try {
        await fetch(urls[i++])
      } catch {
        failed = true // オフラインならやめる
        return
      }
    }
  }
  setTimeout(async () => {
    await Promise.all([0, 1, 2].map(() => worker()))
    if (my === warmToken && !failed && i >= urls.length) {
      try {
        localStorage.setItem(key, '1')
      } catch {
        // 無視
      }
    }
  }, 3000)
}

loadVoice(getVoice())
onSettingsChange(() => {
  if (getVoice() !== loadedVoice) void loadVoice(getVoice())
})

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
// 読み上げのあいだは BGM を小さくする（読み上げが重なっても、全部おわるまで小さいまま）
let speaking = 0

export function stopSpeaking() {
  speakToken++
  stopVoice()
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

/** 読み終わったら resolve。配列なら順番に読む（例: ['せいかい！', 'りんご']） */
export async function speak(text: string | string[], opts?: { rate?: number; pitch?: number }): Promise<void> {
  const parts = Array.isArray(text) ? text : [text]
  const my = ++speakToken
  if (speaking++ === 0) duckBgm(true)
  try {
    await ready // 声を切り替えた直後でも、新しい声で読む
    for (const part of parts) {
      if (my !== speakToken) return
      if (!isMuted() && VOICE[part] && (await playVoice(VOICE[part]))) continue
      if (my !== speakToken) return
      await speakTTS(part, opts)
    }
  } finally {
    if (--speaking === 0) duckBgm(false)
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
