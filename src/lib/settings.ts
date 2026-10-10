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
