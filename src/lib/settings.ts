// ミュート設定（効果音と読み上げの両方）。端末に保存して次回も引き継ぐ
const KEY = 'saru-quiz/muted'
let muted = false
try {
  muted = localStorage.getItem(KEY) === '1'
} catch {
  // 保存できない環境でも動くように
}
const listeners = new Set<(m: boolean) => void>()

export const isMuted = () => muted

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? '1' : '0')
  } catch {
    // 無視
  }
  listeners.forEach((f) => f(m))
}

export function onMutedChange(f: (m: boolean) => void) {
  listeners.add(f)
  return () => listeners.delete(f)
}

// 制限時間（秒）。15 / 30 / 45 から選ぶ
const TIME_KEY = 'saru-quiz/time'
export const TIME_OPTIONS = [15, 30, 45] as const
export type TimeLimit = (typeof TIME_OPTIONS)[number]
let timeLimit: TimeLimit = 15
try {
  const v = Number(localStorage.getItem(TIME_KEY))
  if ((TIME_OPTIONS as readonly number[]).includes(v)) timeLimit = v as TimeLimit
} catch {
  // 保存できない環境では 15 秒
}
export const getTimeLimit = (): TimeLimit => timeLimit
export function setTimeLimit(v: TimeLimit) {
  timeLimit = v
  try {
    localStorage.setItem(TIME_KEY, String(v))
  } catch {
    // 無視
  }
}
