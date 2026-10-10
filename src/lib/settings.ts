// 端末に保存する設定（音・音量・声・プレイヤー名）
const KEY = 'saru-quiz/settings'
const OLD_MUTED_KEY = 'saru-quiz/muted'

export const VOICES = [
  { id: 'zundamon', name: 'ずんだもん' },
  { id: 'metan', name: 'しこくめたん' },
  { id: 'tsumugi', name: 'かすかべつむぎ' },
  { id: 'mochiko', name: 'もちこさん' },
  { id: 'nurserobo', name: 'なーすろぼ' },
] as const
export type VoiceId = (typeof VOICES)[number]['id']

type Settings = { muted: boolean; volume: number; voice: VoiceId; playerName: string; playerId: string }

function load(): Settings {
  const def: Settings = { muted: false, volume: 0.8, voice: 'zundamon', playerName: '', playerId: '' }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) Object.assign(def, JSON.parse(raw))
    else def.muted = localStorage.getItem(OLD_MUTED_KEY) === '1' // 前のバージョンのミュート設定を引き継ぐ
  } catch {
    // 保存できない環境でも動くように
  }
  if (!def.playerId) def.playerId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return def
}

const state = load()
const listeners = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 無視
  }
  listeners.forEach((f) => f())
}
save()

/** 設定が変わったら呼ばれる。戻り値で解除 */
export function onSettingsChange(f: () => void) {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

export const isMuted = () => state.muted
export const getVolume = () => state.volume
export const getVoice = () => state.voice
export const getPlayerName = () => state.playerName
export const getPlayerId = () => state.playerId

export function setMuted(m: boolean) {
  state.muted = m
  save()
}
export function setVolume(v: number) {
  state.volume = Math.max(0, Math.min(1, v))
  save()
}
export function setVoice(v: VoiceId) {
  state.voice = v
  save()
}

// プレイヤー名: ひらがなと「ー」だけ、1〜8文字
export const NAME_RE = /^[ぁ-んー]{1,8}$/
const NG = ['うんこ', 'うんち', 'ちんこ', 'ちんちん', 'まんこ', 'しね', 'ころす', 'ばか', 'あほ', 'くそ', 'きもい', 'うざい']
export function checkName(name: string): string | null {
  if (!NAME_RE.test(name)) return 'ひらがなで 8もじまで いれてね'
  if (NG.some((w) => name.includes(w))) return 'ほかの なまえに してね'
  return null
}
export function setPlayerName(name: string) {
  state.playerName = name
  save()
}
