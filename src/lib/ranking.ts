// オンラインランキング（Supabase）。supabase-js は使わず fetch で REST / RPC を呼ぶ
// 接続先はビルド時の環境変数 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（anon キーは公開してよいキー）
import { getPlayerId, getPlayerName } from './settings'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const PENDING_KEY = 'saru-quiz/pending-scores'

export const rankingEnabled = () => Boolean(URL_BASE && ANON_KEY)

export type Period = 'day' | 'month'
export type ScoreRow = { pub_id: string; name: string; cleared: boolean; clear_ms: number | null; correct: number; bananas: number; best_combo: number }
export type SubmitResult = { day: number; month: number; newBest: boolean }
type Pending = { course: number; cleared: boolean; clearMs: number | null; correct: number; bananas: number; bestCombo?: number }

const headers = () => ({ apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' })

/** 日本時間の「きょう」「こんげつ」のキー（サーバーと同じ作り方） */
export function periodKey(period: Period, d = new Date()) {
  const ymd = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return period === 'day' ? ymd : ymd.slice(0, 7)
}

/** 自分の行を見分けるための公開ID（player_id の SHA-256） */
let myPubId: Promise<string> | null = null
export function getMyPubId() {
  myPubId ??= crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(getPlayerId()))
    .then((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''))
  return myPubId
}

async function post(s: Pending): Promise<SubmitResult> {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/submit_score`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      p_player: getPlayerId(),
      p_name: getPlayerName(),
      p_course: s.course,
      p_cleared: s.cleared,
      // performance.now() 由来の小数はサーバーの integer で弾かれるので丸める
      p_clear_ms: s.clearMs === null ? null : Math.round(s.clearMs),
      p_correct: Math.round(s.correct),
      p_bananas: Math.round(s.bananas),
      p_combo: Math.min(s.bestCombo ?? 0, s.correct),
    }),
  })
  if (!res.ok) throw new Error(`submit ${res.status}`)
  return res.json()
}

function loadPending(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
  } catch {
    return []
  }
}
function savePending(list: Pending[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)))
  } catch {
    // 無視
  }
}

/** スコアを送る。つながらないときはためておき、あとで再送する。なまえ未設定なら送らない */
export async function submitScore(s: Pending): Promise<SubmitResult | null> {
  if (!rankingEnabled() || !getPlayerName()) return null
  try {
    const r = await post(s)
    void flushPending()
    return r
  } catch (e) {
    if (e instanceof TypeError) savePending([...loadPending(), s]) // オフライン
    return null
  }
}

/** ためておいたスコアを送り直す（起動時・送信成功時） */
export async function flushPending() {
  if (!rankingEnabled() || !getPlayerName()) return
  const list = loadPending()
  if (!list.length) return
  const rest: Pending[] = []
  for (const s of list) {
    try {
      await post(s)
    } catch (e) {
      if (e instanceof TypeError) rest.push(s)
    }
  }
  savePending(rest)
}

/** ランキング上位50件 */
export async function fetchRanking(course: number, period: Period): Promise<ScoreRow[]> {
  const q = new URLSearchParams({
    select: 'pub_id,name,cleared,clear_ms,correct,bananas,best_combo',
    course: `eq.${course}`,
    period: `eq.${period}`,
    period_key: `eq.${periodKey(period)}`,
    order: 'cleared.desc,clear_ms.asc.nullslast,correct.desc,bananas.desc',
    limit: '50',
  })
  const res = await fetch(`${URL_BASE}/rest/v1/scores?${q}`, { headers: headers() })
  if (!res.ok) throw new Error(`ranking ${res.status}`)
  return res.json()
}

export const formatTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
