// 日付。端末のローカル時刻で「きょう」を決める。テストでは今の時刻を差しかえられる
let clock: () => number = Date.now

export const now = () => clock()
export function setNow(fn?: () => number) {
  clock = fn ?? Date.now
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ローカル時刻の日付キー 'YYYY-MM-DD' */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const dayNumber = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

/** a から b までの日数（暦の日で数える。サマータイムでもずれない）。a, b は日付キーかミリ秒 */
export function daysBetween(a: string | number, b: string | number): number {
  const k = (x: string | number) => (typeof x === 'number' ? dayKey(x) : x)
  return Math.round(dayNumber(k(b)) - dayNumber(k(a)))
}
