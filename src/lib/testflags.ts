// テスト用のURLパラメータ。?show=<id> ?cat=<カテゴリ名> ?demo は記録もランキングもしない
// ?word=<単語id> はその1語だけ出題（演出の見分けの確認用。記録しない）
// ?start=数 は せいかい数をその数から始める（みちのり・リーチの確認用。記録しない）
// ?hap=<ハプニングのid> は 必ず2問目に そのハプニングを起こす（記録しない）。?hap=off は ハプニングを起こさない（記録はする。smoke 用）
// ?seed ?time ?goal は記録してよい（smoke テストが使う）
const params = () => (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search))

/** 記録（保存・ランキング）を止める実行か */
export function isTestRun(): boolean {
  const p = params()
  return p.has('show') || p.has('cat') || p.has('demo') || p.has('start') || p.has('word') || hapForced() !== null
}

/** ?cat=カテゴリ名（なければ null） */
export const catParam = (): string | null => params().get('cat') || null

/** ?start=数（なければ 0）。せいかい数の はじまりの値 */
export const startParam = (): number => Math.max(0, Math.floor(Number(params().get('start'))) || 0)

/** ?word=単語id（なければ null）。その1語だけ出題する */
export const wordParam = (): string | null => params().get('word') || null

/** ?hap=<id>（なければ null。off は強制ではない） */
export function hapForced(): string | null {
  const v = params().get('hap')
  return v && v !== 'off' ? v : null
}

/** ?hap=off（ハプニングを起こさない） */
export const hapOff = (): boolean => params().get('hap') === 'off'

/** ?seed=値（なければ ''）。ハプニングの乱数の種に混ぜて、?seed ごとに再現できるようにする */
export const seedSalt = (): string => params().get('seed') ?? ''
