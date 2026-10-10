import { useEffect, useRef, useState } from 'react'
import { Band } from '../components/Band'
import { PixelMonkey } from '../components/PixelMonkey'
import { Road } from '../components/Road'
import { burst, fountain, rain, shake, flash } from '../lib/effects'
import { now } from '../lib/day'
import { isCloudy } from '../lib/leitner'
import type { Save } from '../lib/storage'
import { chooseShow, chooseUgoku, chooseZukkoke, layer, makeCtx, peekaboo, play, reachFor, shouldAnnounce, themeOf, unlockCtx } from '../shows'
import { songOf } from '../lib/bgm'
import { getMotion } from '../lib/settings'
import { getCurrent } from '../lib/players'
import { startParam } from '../lib/testflags'
import { COURSE, MODE_RULES, hintFor, makeRound, type Mode, type Question, type Round } from '../lib/quiz'
import { pauseBgm, resumeBgm, setBgmKey, setBgmLevel, sfx, startBgm, stopBgm } from '../lib/sound'
import { preloadSpeech, speak, stopSpeaking } from '../lib/speech'
import type { CharId, Mood } from '../sprites/monkeys'

export type QuizResult = { correct: number; total: number; coins: number; bestCombo: number; answers: { id: string; ok: boolean }[]; cleared: boolean; clearMs?: number }

type Phase = 'reading' | 'answering' | 'correct' | 'wrong' | 'end'
type Banner = { text: string; key: number; kind: 'combo' | 'fever' | 'legend' | 'bonus' | 'end' | 'clear' | 'reach' }

const PRAISE = ['せいかい！', 'すごーい！', 'やったね！', 'あたり！', 'てんさい！']
const PEEKERS: CharId[] = ['mandrill', 'orangutan', 'kinshikou', 'gorilla', 'rainbow', 'sora', 'mint', 'choco']
// フィーバーのレベル（1〜3）。「ねつ」で決まる
const FEVER_MAX = 9
const FEVER_TEXT = ['', 'ふぃーばー！', 'すーぱーふぃーばー！', 'めがふぃーばー！', 'ぱわーふぃーばー！', 'うるとらふぃーばー！', 'ごっどふぃーばー！', 'はいぱーふぃーばー！', 'おーばーふぃーばー！', 'まっくすふぃーばー！']
const FEVER_BADGE = ['', 'ふぃーばー ×2', 'すーぱー ×3', 'めが ×4', 'ぱわー ×5', 'うるとら ×6', 'ごっど ×7', 'はいぱー ×8', 'おーばー ×9', 'まっくす ×10']
// 各レベルに必要なねつ（0〜9）
const FEVER_THRESH = [0, 25, 50, 80, 110, 140, 170, 200, 230, 260]
const feverLevelOf = (h: number) => {
  let lv = 0
  for (let k = 1; k <= FEVER_MAX; k++) if (h >= FEVER_THRESH[k]) lv = k
  return lv
}
// BGMは3レベルごとに変わる（1〜3 / 4〜6 / 7〜9）
const feverGroup = (lv: number) => (lv <= 3 ? 1 : lv <= 6 ? 2 : 3)
const FEVER_CLASSES = Array.from({ length: FEVER_MAX - 1 }, (_, i) => `fever-${i + 2}`)
const DANCERS: CharId[] = ['mandrill', 'sora', 'orangutan', 'monchan', 'mint', 'gorilla', 'choco', 'kinshikou', 'rainbow']
// 時間ゲージ。出題中（読み上げ・回答中）だけ減り、正解すると少し回復する
// テスト用に ?time=秒 で短くできる
// テスト用に ?time=秒 で上書きできる（ふだんは設定画面の制限時間）
const TIME_OVERRIDE = Number(new URLSearchParams(location.search).get('time')) || 0
// テスト用に ?goal=問題数 でクリア条件を上書きできる
const GOAL_OVERRIDE = Number(new URLSearchParams(location.search).get('goal')) || 0
const TIME_BONUS = 3_000 // 正解で +3秒
const TIME_PENALTY = 3_000 // まちがいで -3秒
// テスト用に ?start=数 で せいかい数を その数から始められる（みちのり・リーチの確認用）
const START_CORRECT = startParam()
// 画面のふちで息を止めて見ているおさる（のこり3・2・1問で 3・4・5匹）
const CROWD: CharId[] = ['mandrill', 'sora', 'orangutan', 'mint', 'gorilla']
const TICK = 100
// のこり5秒からは時間の進みを半分に（5→0 を 実際は10秒かけて大きくカウントする）
const COUNTDOWN_MS = 5_000

/** 画面の四辺をぐるっと囲むおさる。フィーバーのレベルが上がるほど数も大きさも増える */
function FeverRing({ level }: { level: number }) {
  const n = Math.min(40, 4 + level * 4) // レベル1: 8匹 … 9: 40匹
  const size = Math.max(24, 34 - level)
  return (
    <div className="fever-ring">
      {Array.from({ length: n }, (_, i) => {
        // 四辺の上を等間隔に並べる（0〜4 の周回パラメータを座標に変換）
        const t = (i / n) * 4
        const [x, y] = t < 1 ? [t, 0] : t < 2 ? [1, t - 1] : t < 3 ? [3 - t, 1] : [0, 4 - t]
        return (
          <div key={i} className="ring-monkey" style={{ left: `${3 + x * 94}%`, top: `${3 + y * 94}%` }}>
            <PixelMonkey char={DANCERS[i % DANCERS.length]} mood="happy" size={size} anim="dance" style={{ animationDelay: `${(i % 4) * 0.12}s` }} />
          </div>
        )
      })}
    </div>
  )
}

/** のこりわずか: 画面の下のふちで、ほっぺをふくらませて息を止めるおさる。クリアで「ぷはーっ！」 */
function ReachCrowd({ n, puha, motion }: { n: number; puha: boolean; motion: number }) {
  if (n <= 0) return null
  return (
    <div className={`reach-crowd ${motion > 0 ? '' : 'still'} ${puha ? 'puha' : ''}`} aria-hidden>
      {CROWD.slice(0, n).map((c, i) => (
        <div key={c} className="reach-mk" style={{ animationDelay: `${i * 0.13}s` }}>
          <PixelMonkey char={c} mood={puha ? 'happy' : 'normal'} size={34} anim={puha && motion > 0 ? 'jump' : 'none'} className="reach-img" style={{ animationDelay: `${i * 0.13}s` }} />
        </div>
      ))}
      {puha && <div className="reach-puha">ぷはーっ！</div>}
    </div>
  )
}

type QuizProps = { mode: Mode; level: number; questions: Question[]; save: Save; onFinish: (r: QuizResult) => void; onQuit: () => void }

export function Quiz({ mode, level, questions, save, onFinish, onQuit }: QuizProps) {
  const rules = MODE_RULES[mode]
  const course = COURSE[level] ?? COURSE[1]
  const TIME_MAX = (TIME_OVERRIDE || course.time) * 1000
  // コースはクリア数、ふくしゅうは出題数（ぜんぶ正解したらクリア）
  const GOAL = rules.course ? GOAL_OVERRIDE || course.goal : questions.length
  const startedAt = useRef(performance.now())
  const queueRef = useRef(questions)
  const [index, setIndex] = useState(0)
  const [round, setRound] = useState<Round>(() => makeRound(questions[0], level))
  // 手がかり: 1回のプレイの中で単語ごとにまちがえた回数 / もう答えた単語 / くもりの単語（遊び始めに決める）
  const misses = useRef(new Map<string, number>())
  const answered = useRef(new Set<string>())
  const cloudy = useRef(new Set(questions.filter((q) => isCloudy(save.stats[q.id], now())).map((q) => q.id)))
  const [wipe, setWipe] = useState<'none' | 'wiping' | 'clean'>('none')
  const [glow, setGlow] = useState(false) // 正解の選択肢をふわっと光らせる（まちがい2回以上のあと）
  const picRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('reading')
  const phaseRef = useRef<Phase>('reading')
  phaseRef.current = phase
  const [reading, setReading] = useState(-1)
  const [picked, setPicked] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [combo, setCombo] = useState(0)
  const [coins, setCoins] = useState(0)
  const coinsRef = useRef(0)
  coinsRef.current = coins
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  // フィーバーは「ねつ」(heat) で決まる。まちがえても0にはならず、少しずつ下がる
  const [heat, setHeat] = useState(0)
  const heatRef = useRef(0)
  const setHeatBoth = (v: number) => {
    heatRef.current = v
    setHeat(v)
  }
  const feverLv = feverLevelOf(heat)
  const [helper, setHelper] = useState<CharId | null>(null)
  const [bubble, setBubble] = useState('これ なあに？')
  const [peeker, setPeeker] = useState<{ char: CharId; key: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState(TIME_MAX)
  const timeRef = useRef(TIME_MAX)
  const [timeGain, setTimeGain] = useState<{ key: number; plus: boolean } | null>(null)
  // ときどき「ボーナス問題」（金色・バナナ3ばい）。最初の2問は普通
  const [isBonus, setIsBonus] = useState(false)
  const stats = useRef({ correct: START_CORRECT, bestCombo: 0, answers: [] as { id: string; ok: boolean }[] })
  const token = useRef(0) // 読み上げ途中で次へ進んだとき、古い非同期処理を止める
  // 演出の解放状況（遊び始めの時点のもの）と、直前に使ったずっこけ
  const unlock = useRef(unlockCtx(save, now()))
  const lastZukkoke = useRef<string | undefined>(undefined)
  // みちのりと BGM の曲は遊び始めに選ぶ。動きの強さも遊び始めのもの
  const [theme] = useState(() => themeOf(chooseShow('michi', save.shows.pick, unlock.current).id))
  const [song] = useState(() => songOf(chooseShow('ongaku', save.shows.pick, unlock.current).id))
  const motion = useRef(getMotion()).current
  const char = getCurrent()?.char ?? 'monchan'
  // クリアまでの進み具合 E と、のこり問題数（リーチ）
  const [correctN, setCorrectN] = useState(START_CORRECT)
  const E = Math.min(1, correctN / GOAL)
  const remaining = GOAL - correctN
  const reach = reachFor(remaining)
  const crowdN = useRef(0)
  if (reach.crowd > 0) crowdN.current = reach.crowd
  const [puha, setPuha] = useState(false)
  const [big, setBig] = useState(false) // ラスト: 問題の絵を少し大きく
  const reachDone = useRef(new Set<number>()) // お知らせを出したのこり数（1回だけ）

  // ふだんのBGM（おさるバンド）。E で楽器とテンポが変わり、リーチで半音上がる
  useEffect(() => {
    startBgm(song, E)
    return () => stopBgm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    setBgmLevel(E)
    setBgmKey(reach.keyUp)
  }, [E, reach.keyUp])

  /** のこり3問・1問のお知らせ（バナナ・ドラムロール・読み上げ）。出したのこり数は覚えておく */
  async function announceReach(rem: number, my: number) {
    const a = reachFor(rem).announce
    if (!a) return
    setBanner({ text: a.banner, kind: 'reach', key: Date.now() })
    setTimeout(() => setBanner(null), 1800)
    if (a.drumroll) sfx.drumroll(0.9)
    await speak(a.speech)
    if (token.current === my) reachDone.current.add(rem)
  }

  // 問題が変わったら「じゃじゃーん」→「これなあに？」→ 選択肢を順番に読み上げ
  useEffect(() => {
    const my = ++token.current
    layer.clear() // 前の問題の演出を片づける
    setPhase('reading')
    setPicked(null)
    setSelected(null)
    setBubble('これ なあに？')
    setWipe('none')
    setGlow(false)
    setBig(reachFor(GOAL - stats.current.correct).bigPic)
    preloadSpeech(round.choices)
    // くもりの絵は金色のかがやき（::after）と重なるので、ボーナスにしない
    const bonus = index >= 2 && !cloudy.current.has(round.q.id) && Math.random() < 0.15
    setIsBonus(bonus)
    sfx.whoosh()
    if (bonus) {
      setBanner({ text: 'ぼーなす！', kind: 'bonus', key: Date.now() })
      setTimeout(() => setBanner(null), 1500)
      sfx.bonus()
      rain('star', 40)
    } else sfx.jajan()
    ;(async () => {
      if (bonus) await speak('ぼーなす！')
      // ?goal=3 のように はじめから のこりわずかなら、最初の問題の前にお知らせ
      const rem = GOAL - stats.current.correct
      if (index === 0 && shouldAnnounce(rem, reachDone.current)) await announceReach(rem, my)
      if (token.current !== my) return
      await wait(250)
      await speak('これ、なあに？')
      for (let i = 0; i < round.choices.length; i++) {
        if (token.current !== my) return
        setReading(i)
        await speak(round.choices[i])
        await wait(120)
      }
      if (token.current !== my) return
      setReading(-1)
      setPhase('answering')
      if (round.hint === 'glow') setGlow(true) // 読み上げが終わったら、正解がふわっと光る
    })()
    return () => stopSpeaking()
  }, [round, index])

  // 時間ゲージ
  useEffect(() => {
    if (!rules.timer) return // ふくしゅうは時間がない
    const id = setInterval(() => {
      const p = phaseRef.current
      if (p !== 'reading' && p !== 'answering') return
      const t = Math.max(0, timeRef.current - (timeRef.current <= COUNTDOWN_MS ? TICK / 2 : TICK))
      if (t <= 10_000 && t % 1000 === 0 && t > 0) sfx.tick(t <= 5_000)
      timeRef.current = t
      setTimeLeft(t)
      if (t === 0) endGame()
    }, TICK)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prevLv = useRef(0)
  const prevGroup = useRef(0)
  useEffect(() => {
    const prev = prevLv.current
    prevLv.current = feverLv
    document.body.classList.remove('fever', ...FEVER_CLASSES)
    if (feverLv === 0) {
      sfx.stopFever()
      prevGroup.current = 0
      resumeBgm() // フィーバーが終わったら ふだんのBGMにもどる
      return
    }
    pauseBgm() // フィーバー中は フィーバーの曲だけ
    document.body.classList.add('fever')
    if (feverLv > 1) document.body.classList.add(`fever-${feverLv}`)
    // 背景の虹のまわる速さ（レベルが高いほど速い）
    document.body.style.setProperty('--fever-speed', `${Math.max(0.5, 2.4 - feverLv * 0.2)}s`)
    // BGMは3レベルごとに切り替え
    const grp = feverGroup(feverLv)
    if (grp !== prevGroup.current) {
      sfx.startFever(feverLv)
      prevGroup.current = grp
    }
    if (feverLv > prev) {
      sfx.feverStart(feverLv)
      celebrateFever(feverLv)
    }
    // レベルが上がるほど、演出が増えていく
    const timers: ReturnType<typeof setInterval>[] = []
    if (feverLv >= 2) timers.push(setInterval(() => fountain('coin', 20 + feverLv * 3), Math.max(1100, 3000 - feverLv * 170)))
    if (feverLv >= 3) timers.push(setInterval(() => rain('star', 40), 2200))
    if (feverLv >= 5) timers.push(setInterval(() => shake('small'), 1400))
    if (feverLv >= 7) timers.push(setInterval(() => burst(Math.random() * innerWidth, innerHeight * (0.2 + Math.random() * 0.6), 'star', 24, 1.4), 1200))
    if (feverLv >= 8) timers.push(setInterval(() => rain('banana', 10), 2000))
    if (feverLv >= 9) timers.push(setInterval(() => flash(), 4000))
    return () => timers.forEach((t) => clearInterval(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feverLv])

  useEffect(
    () => () => {
      document.body.classList.remove('fever', ...FEVER_CLASSES)
      document.body.style.removeProperty('--fever-speed')
      sfx.stopFever()
      layer.clear()
    },
    [],
  )

  function center(el: Element) {
    const r = el.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2] as const
  }

  // 3歳児はひらがなが読めないので、タップは「選ぶ＋読み上げ」だけ。回答は「これ！」ボタンだけで行う
  // （同じボタンを2回タップしても回答にはせず、もう一度読み上げる）
  function select(i: number) {
    if (phase !== 'reading' && phase !== 'answering') return
    token.current++
    stopSpeaking()
    setReading(-1)
    setSelected(i)
    setPhase('answering')
    setBubble('これかな？')
    sfx.select()
    const my = token.current
    void speak(round.choices[i]).then(() => {
      // 読み上げを途中で止めて選んだときも、読み終わったら手がかりを出す
      if (token.current === my && round.hint === 'glow') setGlow(true)
    })
  }

  function decide() {
    if (selected === null) return
    const el = choiceRefs.current[selected]
    if (el) answer(round.choices[selected], el)
  }

  function answer(choice: string, el: HTMLElement) {
    if (phase !== 'reading' && phase !== 'answering') return
    token.current++
    stopSpeaking()
    setReading(-1)
    setPicked(choice)
    const q = round.q
    const [x, y] = center(el)
    const myToken = token.current

    if (choice === q.a) {
      const c = combo + 1
      const add = 10 * (1 + Math.floor(c / 3)) * (isBonus ? 3 : 1) * (feverLv ? feverLv + 1 : 1)
      setCombo(c)
      const nh = Math.min(300, heatRef.current + 10 + feverLv * 2)
      const nlv = feverLevelOf(nh)
      const levelUp = nlv > feverLv ? FEVER_TEXT[nlv] : null
      setHeatBoth(nh)
      setCoins((v) => v + add)
      setGain({ n: add, key: Date.now() })
      if (rules.timer) {
        timeRef.current = Math.min(TIME_MAX, timeRef.current + TIME_BONUS)
        setTimeLeft(timeRef.current)
        setTimeGain({ key: Date.now(), plus: true })
      }
      // くもりの絵を最初の答えで当てたら、拭いてぴかぴかにする
      const polish = !answered.current.has(q.id) && cloudy.current.has(q.id)
      answered.current.add(q.id)
      stats.current.correct++
      setCorrectN(stats.current.correct)
      // 決まった問題数に届いたらクリア（クリアタイムは実際にかかった時間）
      const clearMs = stats.current.correct >= GOAL ? Math.round(performance.now() - startedAt.current) : null
      stats.current.bestCombo = Math.max(stats.current.bestCombo, c)
      stats.current.answers.push({ id: q.id, ok: true })
      setPhase('correct')
      let shout = PRAISE[(Math.random() * PRAISE.length) | 0]
      setBubble(shout)
      if (polish) {
        setWipe('wiping') // 左から右へ0.6秒で拭きとる → キラッと星 → 「ぴかぴか！」
        setTimeout(() => {
          if (token.current !== myToken) return
          setWipe('clean')
          setBubble('ぴかぴか！')
          const r = picRef.current?.getBoundingClientRect()
          if (r) burst(r.left + r.width / 2, r.top + r.height / 2, 'star', 28, 1.2)
          sfx.sparkle()
        }, 600)
      }

      if (clearMs !== null) {
        // ためていた息を「ぷはーっ！」
        setPuha(true)
        setTimeout(() => sfx.puha(), 250)
      }
      sfx.correct(c)
      sfx.coinCascade(Math.min(4 + c, 14))
      if (c >= 2) sfx.comboUp(c)
      flash()
      // 正解のうごくえ（はじける・コインもここ）。進み具合 E は せいかい数 ÷ クリアの数
      void play(chooseUgoku(q.c, unlock.current), makeCtx({ q, E: Math.min(1, stats.current.correct / GOAL), heat: heatRef.current, at: { x, y }, combo: c }))
      if (c === 3) shout = celebrate('すごい！', 'combo', 'mandrill', x, y)
      if (c === 8 || (c > 8 && c % 5 === 3)) shout = celebrate('でんせつ！', 'legend', 'rainbow', x, y)
      if (feverLv > 0) rain('banana', 8)
      if (isBonus) {
        fountain('coin', 50)
        sfx.bonus()
      }
      // ときどき別のおさるが顔を出してよろこぶ
      if (c !== 3 && c !== 5 && c !== 8 && Math.random() < 0.6) {
        setPeeker({ char: PEEKERS[(Math.random() * PEEKERS.length) | 0], key: Date.now() })
        setTimeout(() => setPeeker(null), 1800)
      }

      if (polish) shout = 'ぴかぴか！'
      ;(async () => {
        await speak(levelUp ? [shout, q.a, levelUp] : [shout, q.a])
        await wait(350)
        if (clearMs !== null) return clearGame(clearMs)
        // のこり3問・1問になったら、お知らせしてから次の問題へ
        const rem = GOAL - stats.current.correct
        if (shouldAnnounce(rem, reachDone.current)) await announceReach(rem, myToken)
        if (token.current === myToken) next()
      })()
    } else {
      setCombo(0)
      // ねつは下がる（0にはならない）
      setHeatBoth(Math.max(0, heatRef.current - 40))
      if (rules.timer) {
        timeRef.current = Math.max(0, timeRef.current - TIME_PENALTY)
        setTimeLeft(timeRef.current)
        setTimeGain({ key: Date.now(), plus: false })
      }
      answered.current.add(q.id)
      misses.current.set(q.id, (misses.current.get(q.id) ?? 0) + 1)
      stats.current.answers.push({ id: q.id, ok: false })
      setPhase('wrong')
      setBubble('おしい！')
      sfx.wrong()
      shake('small')
      // まちがえた問題はあとでもう一度
      const qs = queueRef.current
      queueRef.current = [...qs.slice(0, index + 4), q, ...qs.slice(index + 4)]
      // おさるのずっこけ → 正解の絵が おさるの後ろから「ばあ！」と出てくる
      const zk = chooseZukkoke(save.shows.pick, unlock.current, lastZukkoke.current)
      lastZukkoke.current = zk.id
      const zctx = makeCtx({ q, E: Math.min(1, stats.current.correct / GOAL), heat: heatRef.current })
      ;(async () => {
        await Promise.all([play(zk, zctx), speak('おしい！ これは、')])
        await Promise.all([peekaboo(zctx).catch(() => {}), speak([q.a, 'だよ'])])
        await wait(600)
        next()
      })()
    }
  }

  function celebrate(text: string, kind: Banner['kind'], who: CharId, x: number, y: number) {
    setBanner({ text, kind, key: Date.now() })
    setHelper(who)
    setTimeout(() => setHelper(null), 2600)
    setTimeout(() => setBanner(null), 1800)
    if (kind !== 'fever') sfx.combo(kind === 'combo' ? 1 : 6)
    shake(kind === 'combo' ? 'small' : 'big')
    burst(x, y, 'star', 30, 1.3)
    if (kind !== 'combo') {
      fountain('coin', 40)
      rain('confetti', 120)
    }
    if (kind === 'legend') rain('banana', 30)
    return text
  }

  function celebrateFever(lv: number) {
    celebrate(FEVER_TEXT[lv], 'fever', lv >= 6 ? 'rainbow' : 'gorilla', innerWidth / 2, innerHeight * 0.35)
    if (lv >= 2) {
      fountain('coin', 60)
      rain('confetti', 120)
    }
    if (lv >= 3) {
      flash()
      shake('big')
      rain('banana', 40)
      burst(innerWidth / 2, innerHeight * 0.4, 'star', 60, 1.6)
    }
    if (lv >= 6) {
      for (let i = 0; i < 3; i++) setTimeout(() => burst(Math.random() * innerWidth, innerHeight * 0.5, 'coin', 30, 1.2), i * 400)
    }
  }

  function endGame() {
    if (phaseRef.current === 'end') return
    phaseRef.current = 'end'
    setPhase('end')
    token.current++
    stopSpeaking()
    setHeatBoth(0)
    stopBgm()
    setBanner({ text: 'しゅうりょうー！', kind: 'end', key: Date.now() })
    sfx.whistle()
    void speak('しゅうりょうー！')
    setTimeout(() => {
      onFinish({ correct: stats.current.correct, total: stats.current.answers.length, coins: coinsRef.current, bestCombo: stats.current.bestCombo, answers: stats.current.answers, cleared: false })
    }, 2300)
  }

  function clearGame(clearMs: number) {
    if (phaseRef.current === 'end') return
    phaseRef.current = 'end'
    setPhase('end')
    token.current++
    stopSpeaking()
    setHeatBoth(0)
    stopBgm()
    setBanner({ text: 'くりあー！', kind: 'clear', key: Date.now() })
    sfx.fanfare()
    fountain('coin', 80)
    rain('star', 150)
    rain('confetti', 200)
    void speak(mode === 'review' ? 'ふくしゅう、くりあー！' : 'くりあー！')
    setTimeout(() => {
      onFinish({ correct: stats.current.correct, total: stats.current.answers.length, coins: coinsRef.current, bestCombo: stats.current.bestCombo, answers: stats.current.answers, cleared: true, clearMs })
    }, 2800)
  }

  function next() {
    if (phaseRef.current === 'end') return
    if (rules.timer && timeRef.current <= 0) return endGame()
    const qs = queueRef.current
    const ni = (index + 1) % qs.length
    setIndex(index + 1)
    // まちがえたことのある問題は、手がかり（選択肢を減らす / 正解を光らせる）つきで出す
    setRound(makeRound(qs[ni], level, hintFor(misses.current.get(qs[ni].id) ?? 0)))
  }

  const mood: Mood = phase === 'correct' ? 'happy' : phase === 'wrong' ? 'sad' : 'normal'
  const q = round.q
  const pct = (timeLeft / TIME_MAX) * 100
  const countdown = rules.timer && timeLeft > 0 && timeLeft <= COUNTDOWN_MS ? Math.ceil(timeLeft / 1000) : 0

  return (
    <div className={`screen quiz ${feverLv ? `is-fever lv${feverLv}` : ''}`}>
      <header className="quiz-top">
        <button className="quit" onClick={onQuit} aria-label="もどる">✕</button>
        {rules.timer ? (
          <div className={`gauge ${pct < 17 ? 'low' : pct < 40 ? 'mid' : ''}`}>
            <div className="gauge-fill" style={{ width: `${pct}%` }} />
            <span className="gauge-icon">⏰</span>
            {timeGain && (
              <span key={timeGain.key} className={`time-gain ${timeGain.plus ? '' : 'minus'}`}>
                {timeGain.plus ? '+3' : '-3'}
              </span>
            )}
          </div>
        ) : (
          <div className="mode-chip">🔁 ふくしゅう</div>
        )}
        <div className="coin-badge">
          🍌 {coins}
          {gain && <span key={gain.key} className="gain">+{gain.n}</span>}
        </div>
      </header>

      <Road correct={correctN} goal={GOAL} theme={theme} char={char} motion={motion} />

      {countdown > 0 && (
        <div className="countdown" aria-live="assertive">
          <span key={countdown}>{countdown}</span>
        </div>
      )}

      <div className="stage">
        <div className="host">
          <div className="host-monkey">
            <PixelMonkey char={feverLv ? 'rainbow' : 'monchan'} mood={mood} size={60} anim={phase === 'correct' ? 'jump' : 'idle'} />
          </div>
          <div className={`bubble ${phase}`}>{bubble}</div>
        </div>
        <Band E={E} motion={motion} />
        {feverLv > 0 && <div className={`fever-badge lv${feverLv}`}>{FEVER_BADGE[feverLv]}</div>}
        {combo >= 2 && (
          <div className="combo" key={combo}>
            <span className="num">{combo}</span>
            <span>れんぞく！</span>
          </div>
        )}
      </div>

      <div className={`picture-wrap ${big ? 'big' : ''}`}>
        {phase === 'correct' && <div className={`sunburst ${isBonus ? 'gold' : ''}`} />}
        <div
          ref={picRef}
          className={`picture ${phase} ${isBonus ? 'bonus' : ''} ${cloudy.current.has(q.id) && wipe !== 'clean' ? 'is-cloudy' : ''} ${wipe === 'wiping' ? 'is-wiping' : ''}`}
          key={q.id + index}
        >
          {q.img ? <img src={q.img} alt="" draggable={false} /> : <span className="emoji">{q.e}</span>}
        </div>
        {phase === 'correct' && <div className="stamp">せいかい！</div>}
      </div>

      <div className="choices">
        {round.choices.map((c, i) => {
          const done = phase === 'correct' || phase === 'wrong' || phase === 'end'
          const state = done ? (c === q.a ? 'is-answer' : c === picked ? 'is-wrong' : 'is-dim') : selected === i ? 'is-selected' : reading === i ? 'is-reading' : ''
          const hinted = glow && !done && c === q.a // 手がかり: 正解の選択肢がふわっと光る
          return (
            <button
              key={c + index}
              ref={(el) => {
                choiceRefs.current[i] = el
              }}
              className={`btn choice ${state} ${hinted ? 'is-hint' : ''}`}
              style={{ fontSize: `min(30px, ${(74 / c.length).toFixed(1)}vw)` }}
              onClick={() => select(i)}
            >
              {c}
            </button>
          )
        })}
        <button className={`btn decide ${selected !== null && phase === 'answering' ? 'show' : ''}`} onClick={decide} aria-label="これにする">
          <PixelMonkey char="monchan" mood="happy" size={40} anim="none" />
          これ！
        </button>
      </div>

      {feverLv > 0 && (
        <>
          <div className={`fever-frame lv${feverLv}`} />
          <FeverRing level={feverLv} />
        </>
      )}
      <ReachCrowd n={phase === 'end' && !puha ? 0 : reach.crowd > 0 ? reach.crowd : puha ? crowdN.current : 0} puha={puha} motion={motion} />
      {banner && (
        <div className={`banner ${banner.kind}`} key={banner.key}>
          {banner.text}
        </div>
      )}
      {peeker && <PixelMonkey key={peeker.key} char={peeker.char} mood="happy" size={110} anim="none" className="peeker" />}
      {helper && <PixelMonkey key={helper} char={helper} mood="happy" size={120} anim="none" className="helper" />}
    </div>
  )
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
