// Save から解放条件の集計を作る
import { boxOf } from '../lib/leitner'
import { allQuestions } from '../lib/quiz'
import type { Save } from '../lib/storage'
import type { UnlockCtx } from './types'

let catById: Map<string, string> | null = null
const defaultCatOf = (id: string) => {
  catById ??= new Map(allQuestions.map((q) => [q.id, q.c]))
  return catById.get(id)
}

/** catOf は単語 id → カテゴリ名（テストで差しかえる） */
export function unlockCtx(save: Save, _now: number, catOf: (id: string) => string | undefined = defaultCatOf): UnlockCtx {
  let masteredTotal = 0
  let starsTotal = 0
  const masteredByCat: Record<string, number> = {}
  for (const [id, stat] of Object.entries(save.stats)) {
    const box = boxOf(stat)
    starsTotal += box
    if (box < 1) continue
    masteredTotal++
    const c = catOf(id)
    if (c) masteredByCat[c] = (masteredByCat[c] ?? 0) + 1
  }
  return {
    masteredTotal,
    masteredByCat,
    starsTotal,
    playDays: Object.keys(save.diary).length,
    plays: save.plays,
    clears: save.cleared.length,
    polishedTotal: 0,
    seen: save.shows.seen,
    coins: save.coins,
  }
}

/** デモ用: ぜんぶ手に入れている状態（記録はしない。見本をひととおり見せるため） */
export function demoUnlockCtx(cats: string[]): UnlockCtx {
  return {
    masteredTotal: 9999,
    masteredByCat: Object.fromEntries(cats.map((c) => [c, 99])),
    starsTotal: 9999,
    playDays: 99,
    plays: 999,
    clears: 99,
    polishedTotal: 99,
    seen: {},
    coins: 99999,
  }
}
