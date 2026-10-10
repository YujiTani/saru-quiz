// テスト用のURLパラメータ。?show=<id> ?cat=<カテゴリ名> ?demo は記録もランキングもしない
// ?start=数 は せいかい数をその数から始める（みちのり・リーチの確認用。記録しない）
// ?seed ?time ?goal は記録してよい（smoke テストが使う）
const params = () => (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search))

/** 記録（保存・ランキング）を止める実行か */
export function isTestRun(): boolean {
  const p = params()
  return p.has('show') || p.has('cat') || p.has('demo') || p.has('start')
}

/** ?cat=カテゴリ名（なければ null） */
export const catParam = (): string | null => params().get('cat') || null

/** ?start=数（なければ 0）。せいかい数の はじまりの値 */
export const startParam = (): number => Math.max(0, Math.floor(Number(params().get('start'))) || 0)
