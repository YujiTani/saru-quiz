import { useEffect, useRef, useState } from 'react'
import { PixelMonkey } from '../components/PixelMonkey'
import { BananaPile } from '../components/BananaPile'
import { ShowGift } from '../components/ShowGift'
import { Sticker } from '../components/Sticker'
import { WordTile } from '../components/WordTile'
import { BANANA_STAGES } from '../lib/banana'
import { burst, fountain, rain, shake } from '../lib/effects'
import { rankingEnabled, submitScore, type SubmitResult } from '../lib/ranking'
import { getPlayerName } from '../lib/players'
import type { ResultEvents } from '../lib/progress'
import { MODE_RULES, type Mode } from '../lib/quiz'
import { STICKER_KINDS, stickerImg, stickerInSet } from '../lib/stickers'
import { isTestRun } from '../lib/testflags'
import { sfx } from '../lib/sound'
import { speak } from '../lib/speech'
import type { QuizResult } from './Quiz'

// 0: けっかはっぴょうー！ 1: せいかい数 2: れんぞく 3: バナナ集計 4: おわり（ボタン表示）
type Stage = 0 | 1 | 2 | 3 | 4

type Props = { mode: Mode; level: number; result: QuizResult; events?: ResultEvents; totalCoins: number; onAgain: () => void; onHome: () => void; onRanking: () => void }

const NO_EVENTS: ResultEvents = { newMastered: [], starUps: [], polished: [], firstPlayToday: false, sticker: null, bananaUp: null, newShows: [], growth: [] }
const TILES_MAX = 6
/** 1回のプレイで見せるプレゼントは3つまで（ほかは「ほかにも N こ！」） */
const GIFT_MAX = 3

type Tail = { grow: boolean; mastered: boolean; stars: boolean; polish: boolean; sticker: boolean; banana: boolean; more: boolean }

export function Result({ mode, level, result, events = NO_EVENTS, totalCoins, onAgain, onHome, onRanking }: Props) {
  const rules = MODE_RULES[mode]
  const review = mode === 'review'
  // 「まえより のびたよ」と「おぼえたよ」のカード（結果発表の最後に1つずつ出す）
  const [tail, setTail] = useState<Tail>({ grow: false, mastered: false, stars: false, polish: false, sticker: false, banana: false, more: false })
  // プレゼント（新しく手に入れた演出）。いま開けているもの
  const [gift, setGift] = useState<{ id: string; key: number } | null>(null)
  const giftDone = useRef<(() => void) | null>(null)
  const [moreN, setMoreN] = useState(0)
  const mastered = events.newMastered.slice(0, TILES_MAX)
  const starUps = events.starUps.filter(([id]) => !events.newMastered.includes(id)).slice(0, TILES_MAX)
  const polished = events.polished.slice(0, TILES_MAX)
  const [stage, setStage] = useState<Stage>(0)
  const [stars, setStars] = useState(0)
  const [shown, setShown] = useState(0)
  const [ask, setAsk] = useState(false)
  const [rank, setRank] = useState<SubmitResult | null>(null)
  const rankRef = useRef<SubmitResult | null>(null)
  const n = result.correct
  const perfect = n >= 5 && result.answers.every((a) => a.ok)

  // ランキングに送る（クリアしたらクリアタイム、しなかったら正解数。どちらもバナナ数つき）
  useEffect(() => {
    if (isTestRun() || !rules.ranked) return // テスト用のURLと、ふくしゅうはランキングに送らない
    void submitScore({ course: level, cleared: result.cleared, clearMs: result.clearMs ?? null, correct: result.correct, bananas: result.coins, bestCombo: result.bestCombo }).then((r) => {
      rankRef.current = r
      setRank(r)
    })
  }, [level, result, rules.ranked])

  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, f: () => void) => timers.push(setTimeout(() => alive && f(), ms))
    // ★は約1.6秒で数え終わるように（100問クリアでも長くならない）
    const per = Math.max(16, Math.min(160, 1600 / Math.max(n, 1)))
    const tickEvery = Math.max(1, Math.ceil(n / 30))

    // けっかはっぴょうー！（ドラムロール）
    sfx.drumroll(1.6)
    void speak('けっかはっぴょうー！')

    // せいかい数: ★がポンポン増える
    at(1800, () => {
      setStage(1)
      sfx.jan()
      shake('small')
      for (let i = 1; i <= n; i++)
        at(i * per, () => {
          setStars(i)
          if (i % tickEvery === 0) sfx.tick()
        })
      at(n * per + 200, () => {
        sfx.combo(2)
        burst(innerWidth / 2, innerHeight * 0.4, 'star', 30, 1.2)
        if (!review && result.cleared && result.clearMs) {
          const sec = Math.floor(result.clearMs / 1000)
          const m = Math.floor(sec / 60)
          void speak([`${n}こ、せいかい！`, 'くりあたいむは', ...(m > 0 ? [`${m}ふん`] : []), `${sec % 60}びょう`, 'だよ'])
        } else void speak(n > 0 ? `${n}こ、せいかい！` : 'よくがんばったね！')
      })
    })

    const t2 = 1800 + per * n + (result.cleared ? 4200 : 1700)
    // さいこう れんぞく
    at(t2, () => {
      setStage(2)
      if (result.bestCombo >= 2) {
        sfx.comboUp(result.bestCombo)
        burst(innerWidth / 2, innerHeight * 0.5, 'confetti', 40)
      }
    })

    // バナナ集計（ジャラジャラ）→ ファンファーレ
    at(t2 + 900, () => {
      setStage(3)
      const steps = 24
      for (let i = 1; i <= steps; i++)
        at(i * 50, () => {
          setShown(Math.round((result.coins * i) / steps))
          if (i % 2) sfx.coin()
        })
      at(steps * 50 + 300, () => {
        setStage(4)
        sfx.fanfare()
        fountain('coin', 70)
        rain('confetti', 180)
        if (perfect) {
          rain('star', 120)
          rain('banana', 30)
          void speak('ぱーふぇくと！ ぜんぶ、せいかい！ すごーい！')
        } else void speak('よくできました！')
        // 発表が終わってから少し間をおいて、「まえより のびたよ」→「おぼえたよ」→ きょうの順位 →「まだ あそぶ〜？」
        void (async () => {
          const sleep = (ms: number) => new Promise<void>((r) => at(ms, r))
          const show = (k: keyof Tail) => {
            setTail((t) => ({ ...t, [k]: true }))
            sfx.sparkle()
            burst(innerWidth / 2, innerHeight * 0.6, 'star', 14, 0.9)
          }
          await sleep(perfect ? 4200 : 2400)
          if (events.growth.length > 0) {
            show('grow')
            await speak(['まえより、のびたよ！', ...events.growth.map((l) => l.speech)])
            if (!alive) return
            await sleep(500)
          }
          if (mastered.length > 0) {
            show('mastered')
            await speak('あたらしく、おぼえたよ！')
            if (!alive) return
            await sleep(500)
          }
          if (starUps.length > 0) {
            show('stars')
            await speak('ほしが、ふえたよ！')
            if (!alive) return
            await sleep(400)
          }
          if (polished.length > 0) {
            show('polish')
            await speak('ぴかぴか！')
            if (!alive) return
            await sleep(400)
          }
          // シール（その日はじめて）。回りながら飛んできて、ぺたっと貼られる。7枚そろったら紙ふぶきを多めに
          if (events.sticker) {
            show('sticker')
            at(650, () => {
              sfx.paste()
              burst(innerWidth / 2, innerHeight * 0.55, 'star', 16, 0.9)
            })
            if (events.sticker.complete) {
              rain('confetti', 320)
              fountain('star', 80)
            }
            await speak(events.sticker.complete ? ['シールを、もらったよ！', 'シールが、ぜんぶ、そろったよ！'] : 'シールを、もらったよ！')
            if (!alive) return
            await sleep(500)
          }
          // バナナのやま（段階が上がったとき）
          if (events.bananaUp !== null) {
            show('banana')
            rain('banana', 40)
            await speak(BANANA_STAGES[events.bananaUp].say)
            if (!alive) return
            await sleep(500)
          }
          // えんしゅつのプレゼント（新しく手に入れたもの。3つまで）
          const gifts = events.newShows.slice(0, GIFT_MAX)
          for (const id of gifts) {
            await new Promise<void>((resolve) => {
              giftDone.current = resolve
              setGift({ id, key: Date.now() })
            })
            setGift(null)
            if (!alive) return
            await sleep(400)
          }
          const rest = events.newShows.length - gifts.length
          if (rest > 0) {
            setMoreN(rest)
            show('more')
            await speak(`ほかにも、${rest}こ！`)
            if (!alive) return
            await sleep(600)
          }
          setAsk(true)
          sfx.coin()
          const r = rankRef.current
          void speak(r && r.day <= 50 ? ['きょうの', `${r.day}い！`, 'まだ、あそぶー？'] : 'まだ、あそぶー？')
        })()
      })
    })
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, n, perfect, events])

  // カードが出たら、見えるところまでスクロール
  const tailRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (Object.values(tail).some(Boolean)) tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [tail])
  useEffect(() => {
    if (gift) tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [gift])

  // 「まだ、あそぶー？」が出たら一番下までスクロール（上に戻せば結果も見られる）
  const askRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ask) askRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [ask])

  return (
    <div className="screen result">
      {stage === 0 ? (
        <h2 className="result-announce">
          けっか
          <br />
          はっぴょうー！
        </h2>
      ) : (
        <h2 className={`result-title pop ${stage === 4 && perfect ? 'perfect' : ''}`}>
          {stage === 4 ? (perfect ? 'ぱーふぇくと！' : review && result.cleared ? <>ふくしゅう<br />くりあー！</> : 'よくできました！') : 'けっか'}
        </h2>
      )}
      {review && <div className="mode-chip result-mode">🔁 ふくしゅう</div>}
      <div className="result-monkeys">
        <PixelMonkey char="mandrill" mood="happy" size={58} anim={stage >= 1 ? 'dance' : 'idle'} />
        <PixelMonkey char="monchan" mood="happy" size={100} anim={stage === 4 ? 'jump' : stage >= 1 ? 'dance' : 'idle'} />
        <PixelMonkey char="gorilla" mood="happy" size={66} anim={stage >= 1 ? 'dance' : 'idle'} />
      </div>
      {stage >= 1 && !review && result.cleared && result.clearMs !== undefined && (
        <div className="result-cleartime">
          <span>⏱ くりあたいむ</span>
          <span className="time">
            <b>{Math.floor(result.clearMs / 60000)}</b>ふん<b>{String(Math.floor(result.clearMs / 1000) % 60).padStart(2, '0')}</b>びょう
          </span>
        </div>
      )}
      {stage >= 1 && (
        <div className="result-count">
          <span>せいかい</span>
          <span className="num" key={stars}>
            {stars}
          </span>
          <span>もん！</span>
        </div>
      )}
      {stage >= 1 && (
        <div className="result-stars">
          {Array.from({ length: Math.min(stars, 30) }, (_, i) => (
            <span key={i} className="on">
              ★
            </span>
          ))}
        </div>
      )}
      {stage >= 2 && result.bestCombo >= 2 && <div className="result-combo pop">さいこう {result.bestCombo} れんぞく！</div>}
      {stage >= 3 && (
        <div className="result-coins">
          <span className="coin-big">🍌</span>
          <span className="num">+{shown}</span>
        </div>
      )}
      {stage >= 4 && <div className="result-total">ぜんぶで 🍌 {totalCoins}</div>}
      {(Object.values(tail).some(Boolean) || gift) && (
      <div className="result-tail" ref={tailRef}>
        {tail.grow && (
          <div className="learn-card grow-card pop">
            <div className="learn-title">📈 まえより のびたよ！</div>
            {events.growth.map((l) => (
              <div key={l.speech} className="grow-line">
                {l.text}
              </div>
            ))}
          </div>
        )}
        {tail.mastered && (
          <div className="learn-card pop">
            <div className="learn-title">🌟 あたらしく おぼえたよ！</div>
            <div className="learn-row">
              {mastered.map((id) => (
                <WordTile key={id} id={id} badge="☆" />
              ))}
              {events.newMastered.length > TILES_MAX && <span className="learn-more">+{events.newMastered.length - TILES_MAX}</span>}
            </div>
          </div>
        )}
        {tail.stars && (
          <div className="learn-card small pop">
            <div className="learn-title">☆が ふえたよ！</div>
            <div className="learn-row">
              {starUps.map(([id, box]) => (
                <WordTile key={id} id={id} badge={`☆${box}`} />
              ))}
            </div>
          </div>
        )}
        {tail.polish && (
          <div className="learn-card small pop">
            <div className="learn-title">✨ ぴかぴかに したよ！</div>
            <div className="learn-row">
              {polished.map((id) => (
                <WordTile key={id} id={id} badge="✨" />
              ))}
            </div>
          </div>
        )}
        {tail.sticker && events.sticker && (
          <div className={`learn-card sticker-card pop ${events.sticker.complete ? 'complete' : ''}`}>
            <div className="learn-title">
              {events.sticker.complete ? (
                <>
                  🎉 シールが
                  <br />
                  ぜんぶ そろったよ！
                </>
              ) : (
                '🌟 シールを もらったよ！'
              )}
            </div>
            <div className="sticker-hero">
              <Sticker kind={events.sticker.kind} size={104} className="fly" />
            </div>
            <div className="sticker-sheet" aria-hidden>
              {Array.from({ length: STICKER_KINDS }, (_, i) => (
                <span key={i} className={`sticker-slot ${i < stickerInSet(events.sticker!.count) ? 'got' : ''} ${i === stickerInSet(events.sticker!.count) - 1 ? 'new' : ''}`}>
                  {i < stickerInSet(events.sticker!.count) && <img src={stickerImg(i)} alt="" draggable={false} />}
                </span>
              ))}
            </div>
          </div>
        )}
        {tail.banana && events.bananaUp !== null && (
          <div className="learn-card banana-card pop">
            <div className="learn-title">
              🍌 バナナが
              <br />
              {BANANA_STAGES[events.bananaUp].card}に なったよ！
            </div>
            <BananaPile stage={events.bananaUp} size={170} className="pile-pop" />
          </div>
        )}
        {gift && <ShowGift key={gift.key} showId={gift.id} onDone={() => giftDone.current?.()} />}
        {tail.more && <div className="learn-card more-card pop">🎁 ほかにも {moreN}こ！</div>}
      </div>
      )}
      {ask && (
        <div className="again-pop" ref={askRef}>
          <div className="again-card">
            <PixelMonkey char="monchan" mood="happy" size={72} anim="jump" />
            {rank ? (
              <p className="again-rank">
                🏆 きょうの <b>{rank.day}</b>い！ こんげつ <b>{rank.month}</b>い{rank.newBest && <span className="new-best">しんきろく！</span>}
              </p>
            ) : (
              rankingEnabled() && !getPlayerName() && <p className="again-note">せっていで なまえを いれると ランキングに のるよ</p>
            )}
            <p className="again-q">まだ、あそぶー？</p>
            <button className="btn again" onClick={() => { sfx.tap(); onAgain() }}>もういっかい！</button>
            <button className="btn home" onClick={() => { sfx.tap(); onHome() }}>おわり</button>
            {rules.ranked && <button className="btn rank-link" onClick={() => { sfx.tap(); onRanking() }}>🏆 らんきんぐを みる</button>}
          </div>
        </div>
      )}
    </div>
  )
}
