// えにっきの月のページ（純粋）。月は 1〜12
export type YM = { y: number; m: number }

/** その月の最初の日の曜日（0=にち … 6=ど）と日数 */
export function monthLayout(y: number, m: number): { startDow: number; days: number } {
  return { startDow: new Date(y, m - 1, 1).getDay(), days: new Date(y, m, 0).getDate() }
}

/** 月をずらす（年をまたぐ） */
export function addMonth(ym: YM, d: number): YM {
  const i = ym.y * 12 + (ym.m - 1) + d
  return { y: Math.floor(i / 12), m: (i % 12) + 1 }
}

export const cmpMonth = (a: YM, b: YM) => a.y * 12 + a.m - (b.y * 12 + b.m)

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKeyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** 月のマス（先頭の空きは null）。7の倍数に並ぶ */
export function monthCells(y: number, m: number): (number | null)[] {
  const { startDow, days } = monthLayout(y, m)
  const cells: (number | null)[] = [...Array<null>(startDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 'YYYY-MM-DD' → '10がつ 11にち' */
export function fmtDay(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${m}がつ ${d}にち`
}
