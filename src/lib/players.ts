// プレイヤー（キャラ）。1台の端末で3人まで作れて、タイトルで切り替える
// キャラごとに分けるもの: なまえ・見た目・色・ランキングのID・バナナ・コース解放・問題ごとの記録
import type { CharId } from '../sprites/monkeys'
import { emptySave, loadOldSave, normalizeSave, type Save } from './storage'

const KEY = 'saru-quiz/players'
const OLD_SETTINGS_KEY = 'saru-quiz/settings'
export const MAX_PLAYERS = 3

export const CHARS: { id: CharId; name: string }[] = [
  { id: 'monchan', name: 'もんちゃん' },
  { id: 'sora', name: 'そら' },
  { id: 'mint', name: 'みんと' },
  { id: 'choco', name: 'ちょこ' },
  { id: 'rainbow', name: 'にじいろ' },
  { id: 'mandrill', name: 'まんどりる' },
  { id: 'orangutan', name: 'おらんうーたん' },
  { id: 'kinshikou', name: 'きんしこう' },
  { id: 'gorilla', name: 'ごりら' },
]
/** テーマの色（タイトル画面の背景・名前の板・ボタンのふち） */
export const COLORS = ['#ff6a8a', '#ffa02a', '#ffd84a', '#5ad06a', '#38b6ff', '#8a6af0', '#c86ad8', '#8a6a4a']

export type Player = { id: string; name: string; char: CharId; color: string; save: Save }
type Store = { current: string | null; list: Player[] }

const newId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Store
      s.list = s.list.map((p) => ({ ...p, save: normalizeSave(p.save) }))
      return s
    }
    // 前のバージョン（1人ぶん）のデータがあれば 1人目のキャラに引き継ぐ。ランキングのIDも同じものを使う
    const old = loadOldSave()
    const settings = JSON.parse(localStorage.getItem(OLD_SETTINGS_KEY) ?? '{}') as { playerName?: string; playerId?: string }
    if (old.plays > 0 || settings.playerName) {
      const p: Player = { id: settings.playerId || newId(), name: settings.playerName || 'ぷれいやー', char: 'monchan', color: COLORS[0], save: old }
      return { current: p.id, list: [p] }
    }
  } catch {
    // 保存できない環境でも遊べるように
  }
  return { current: null, list: [] }
}

const store = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // 無視
  }
  listeners.forEach((f) => f())
}
persist()

export function onPlayersChange(f: () => void) {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

export const getPlayers = () => store.list
export const getCurrent = (): Player | null => store.list.find((p) => p.id === store.current) ?? store.list[0] ?? null
export const getPlayerId = () => getCurrent()?.id ?? ''
export const getPlayerName = () => getCurrent()?.name ?? ''

export function selectPlayer(id: string) {
  if (!store.list.some((p) => p.id === id)) return
  store.current = id
  persist()
}

export function addPlayer(p: { name: string; char: CharId; color: string }): Player | null {
  if (store.list.length >= MAX_PLAYERS) return null
  const player: Player = { id: newId(), ...p, save: emptySave() }
  store.list.push(player)
  store.current = player.id
  persist()
  return player
}

export function updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'char' | 'color'>>) {
  const p = store.list.find((x) => x.id === id)
  if (!p) return
  Object.assign(p, patch)
  persist()
}

export function savePlayerData(id: string, save: Save) {
  const p = store.list.find((x) => x.id === id)
  if (!p) return
  p.save = save
  persist()
}

export function deletePlayer(id: string) {
  store.list = store.list.filter((p) => p.id !== id)
  if (store.current === id) store.current = store.list[0]?.id ?? null
  persist()
}
