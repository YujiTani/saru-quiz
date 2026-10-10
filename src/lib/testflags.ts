// テスト用のURLパラメータ。?show=<id> ?cat=<カテゴリ名> ?demo は記録もランキングもしない
// ?seed ?time ?goal は記録してよい（smoke テストが使う）
const params = () => (typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search))

/** 記録（保存・ランキング）を止める実行か */
export function isTestRun(): boolean {
  const p = params()
  return p.has('show') || p.has('cat') || p.has('demo')
}

/** ?cat=カテゴリ名（なければ null） */
export const catParam = (): string | null => params().get('cat') || null
