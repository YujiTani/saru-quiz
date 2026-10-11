// 端末に保存する設定（音・音量・声）。なまえ・見た目はキャラごと（players.ts）
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

// motion: 動きの強さ 0〜1。さわるまでは未保存で、端末の「視差効果を減らす」設定に合わせる
// guideSeen: はじめてのガイドを見たか（端末共通）
type Settings = { muted: boolean; volume: number; voice: VoiceId; motion?: number; guideSeen?: boolean }

/** 端末が「視差効果を減らす」ならゼロ、そうでなければ最大 */
const defaultMotion = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1)

// 前のバージョンの項目（playerName / playerId）は キャラへの引き継ぎ用に消さずに残す
let rest: Record<string, unknown> = {}

function load(): Settings {
  const def: Settings = { muted: false, volume: 0.8, voice: 'zundamon' }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const { muted, volume, voice, motion, guideSeen, ...others } = JSON.parse(raw)
      rest = others
      Object.assign(def, { muted: muted ?? def.muted, volume: volume ?? def.volume, voice: voice ?? def.voice })
      if (guideSeen === true) def.guideSeen = true
      if (typeof motion === 'number') def.motion = Math.max(0, Math.min(1, motion))
    }
    else def.muted = localStorage.getItem(OLD_MUTED_KEY) === '1' // 前のバージョンのミュート設定を引き継ぐ
  } catch {
    // 保存できない環境でも動くように
  }
  return def
}

const state = load()
const listeners = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...rest, ...state }))
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
export const getMotion = () => state.motion ?? defaultMotion()

export const getGuideSeen = () => state.guideSeen === true
export function setGuideSeen() {
  state.guideSeen = true
  save()
}

export function setMuted(m: boolean) {
  state.muted = m
  save()
}
export function setVolume(v: number) {
  state.volume = Math.max(0, Math.min(1, v))
  save()
}
export function setMotion(m: number) {
  state.motion = Math.max(0, Math.min(1, Math.round(m * 10) / 10))
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
