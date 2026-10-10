// ファミコン風の効果音を WebAudio で合成（音声ファイル不要）
import { getVolume, isMuted, onSettingsChange } from './settings'
import { bpmAt, layersAt, stepSec, type Song, type Step } from './bgm'
import { PHRASES, type Instrument } from './instruments'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let voiceGain: GainNode | null = null
let voiceSrc: AudioBufferSourceNode | null = null
// BGM用の音量の出口（効果音より かなり小さい）。読み上げ中はさらに下げる
let bgmBus: GainNode | null = null
const buffers = new Map<string, Promise<AudioBuffer>>()

/** iOS はユーザー操作の中で一度鳴らさないと音が出ないので、最初のタップで呼ぶ */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    voiceGain = ctx.createGain()
    bgmBus = ctx.createGain()
    bgmBus.gain.value = BGM_VOLUME
    bgmBus.connect(master)
    applyVolume()
    onSettingsChange(applyVolume)
    master.connect(ctx.destination)
    voiceGain.connect(ctx.destination)
    allowWithSilentSwitch()
  }
  resumeAudio()
  // 無音を一瞬鳴らして確実に有効化（古い iOS 対策）
  const b = ctx.createBuffer(1, 1, 22050)
  const src = ctx.createBufferSource()
  src.buffer = b
  src.connect(ctx.destination)
  src.start(0)
}

/** 音のあり/なし・音量を反映（効果音は声より小さめ） */
function applyVolume() {
  const v = isMuted() ? 0 : getVolume()
  if (master) master.gain.value = 0.25 * v
  if (voiceGain) voiceGain.gain.value = v
}

/** アプリを裏に回して戻ると iOS が音を止めることがあるので、タップのたびに復帰させる */
export function resumeAudio() {
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {})
}

/**
 * iPhone はマナーモード（消音スイッチ）中、Web Audio の音が鳴らない。
 * iOS 17+ は audioSession を「playback」にすれば動画と同じく鳴る。
 * それより古い iOS は、無音の <audio> を流し続けると同じ扱いになる。
 */
function allowWithSilentSwitch() {
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'playback'
      return
    } catch {
      // 下の方法にフォールバック
    }
  }
  const el = document.createElement('audio')
  el.src = URL.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' }))
  el.loop = true
  el.setAttribute('playsinline', '')
  void el.play().catch(() => {})
}

/** 0.5秒の無音 WAV */
function silentWav() {
  const rate = 8000
  const n = rate / 2
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  str(36, 'data')
  v.setUint32(40, n, true)
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128)
  return buf
}

function loadBuffer(url: string) {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx!.decodeAudioData(b))
    p.catch(() => buffers.delete(url))
    buffers.set(url, p)
  }
  return p
}

/** 録音済みの声（mp3）を鳴らす。鳴らし終わったら resolve。鳴らせなければ false */
export async function playVoice(url: string): Promise<boolean> {
  if (!ctx || !voiceGain) return false
  try {
    const buf = await loadBuffer(url)
    stopVoice()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(voiceGain)
    voiceSrc = src
    await new Promise<void>((resolve) => {
      src.onended = () => resolve()
      src.start()
    })
    return true
  } catch {
    return false
  }
}

/** 先読み（次の問題の選択肢など） */
export function preloadVoice(url: string) {
  if (ctx) void loadBuffer(url).catch(() => {})
}

export function stopVoice() {
  try {
    voiceSrc?.stop()
  } catch {
    // すでに止まっている
  }
  voiceSrc = null
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 1, slideTo?: number, out?: AudioNode | null) {
  if (!ctx || !master) return
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(g).connect(out ?? master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

const note = (n: number) => 440 * Math.pow(2, (n - 69) / 12) // MIDI番号 → Hz

let noiseBuf: AudioBuffer | null = null
/** ノイズ（シュッ・ドラム用） */
function noise(start: number, dur: number, vol = 0.5, from = 800, to = 8000, type: BiquadFilterType = 'bandpass', out?: AudioNode | null) {
  if (!ctx || !master) return
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t = ctx.currentTime + start
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(f).connect(g).connect(out ?? master)
  src.start(t)
  src.stop(t + dur + 0.02)
}

// ---- ふだんのBGM（おさるバンド）----
// 曲のデータと「どの楽器をいつ鳴らすか」は bgm.ts。ここは WebAudio で ファミコン風の音にして、少し先まで予約していく
const BGM_VOLUME = 0.4 // 効果音（master）に対する大きさ
let bgm: { song: Song; step: number; next: number; timer: ReturnType<typeof setInterval> } | null = null
let bgmPaused = false
let bgmLevel = 0
let bgmKey = 0
let bgmDucked = false

const hz = (n: number) => note(n + bgmKey)

/** 立ち上がりのある音（コーラス・ラッパ用）。dur 秒で消える */
function voice(freq: number, start: number, dur: number, type: OscillatorType, vol: number, attack = 0.03) {
  if (!ctx || !bgmBus) return
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + Math.min(attack, dur / 2))
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.08))
  g.gain.linearRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(bgmBus)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** 1ステップぶんを鳴らす。at は 今から何秒後か */
function playStep(song: Song, i: number, at: number, sec: number) {
  const on = layersAt(bgmLevel)
  const stac = song.staccato ? 0.5 : 0.9
  // たいこ: キック・ハイハット（おまつりは どん・かっ）
  const bar = song.drums[Math.floor(i / song.barSteps) % song.drums.length]
  const d = bar[i % song.barSteps]
  if (d === 'K') tone(150, at, 0.14, 'sine', 0.9, 45, bgmBus)
  else if (d === 'h') noise(at, 0.03, 0.22, 7000, 9000, 'highpass', bgmBus)
  else if (d === 'd') tone(120, at, 0.2, 'sine', 1, 55, bgmBus)
  else if (d === 'k') noise(at, 0.06, 0.4, 1800, 900, 'bandpass', bgmBus)
  const pick = (t: Step[]) => t[i % t.length]
  const b = on.includes('bass') ? pick(song.bass) : null
  if (b) b.n.forEach((n) => tone(hz(n), at, Math.min(b.len * sec * stac, 0.9), 'triangle', 0.7, undefined, bgmBus))
  // マリンバ風: ぽこっとした音＋高い倍音
  const m = on.includes('marimba') ? pick(song.marimba) : null
  if (m)
    m.n.forEach((n) => {
      tone(hz(n), at, 0.28, 'sine', 0.4, undefined, bgmBus)
      tone(hz(n) * 4, at, 0.07, 'sine', 0.12, undefined, bgmBus)
    })
  // ラッパ風のメロディ
  const l = on.includes('lead') ? pick(song.lead) : null
  if (l) l.n.forEach((n) => voice(hz(n), at, Math.max(0.08, l.len * sec * (song.staccato ? 0.45 : 0.92)), 'sawtooth', 0.15, 0.015))
  // コーラス: やわらかい矩形波の和音
  const c = on.includes('choir') ? pick(song.choir) : null
  if (c) c.n.forEach((n) => voice(hz(n), at, c.len * sec * 0.95, 'square', 0.055, 0.12))
}

function bgmTick() {
  if (!ctx || !bgm || bgmPaused) return
  const sec = stepSec(bpmAt(bgmLevel, bgm.song.bpmScale))
  if (bgm.next < ctx.currentTime - 0.05) bgm.next = ctx.currentTime + 0.05 // 止まっていたあとは追いかけない
  while (bgm.next < ctx.currentTime + 0.2) {
    playStep(bgm.song, bgm.step % bgm.song.steps, Math.max(0, bgm.next - ctx.currentTime), stepSec(bpmAt(bgmLevel, bgm.song.bpmScale)))
    bgm.next += sec
    bgm.step++
  }
}

const applyDuck = () => {
  if (!ctx || !bgmBus) return
  bgmBus.gain.cancelScheduledValues(ctx.currentTime)
  bgmBus.gain.linearRampToValueAtTime(bgmDucked ? BGM_VOLUME * 0.5 : BGM_VOLUME, ctx.currentTime + 0.15)
}

/** ふだんのBGMをはじめる。E（0〜1）は楽器の数とテンポ */
export function startBgm(song: Song, E = 0) {
  stopBgm()
  if (!ctx) return
  bgmLevel = E
  bgmKey = 0
  bgmPaused = false
  bgm = { song, step: 0, next: ctx.currentTime + 0.1, timer: setInterval(bgmTick, 40) }
  applyDuck()
  bgmTick()
}

/** クリアまでの進み具合 E。楽器が増え、テンポが上がる */
export function setBgmLevel(E: number) {
  bgmLevel = E
}

/** 半音いくつ上げるか（リーチで +1） */
export function setBgmKey(semitones: number) {
  bgmKey = semitones
}

/** ひとやすみ（フィーバー中）。resumeBgm で つづきから */
export function pauseBgm() {
  bgmPaused = true
}

export function resumeBgm() {
  if (!bgm || !bgmPaused) return
  bgmPaused = false
  if (ctx) bgm.next = ctx.currentTime + 0.1
}

export function stopBgm() {
  if (bgm) clearInterval(bgm.timer)
  bgm = null
  bgmPaused = false
  bgmKey = 0
}

/** 読み上げのあいだ BGM の音量を半分にする */
export function duckBgm(on: boolean) {
  bgmDucked = on
  applyDuck()
}

// ---- フィーバー中のBGM（150BPMのチップチューン） ----
let feverTimer: ReturnType<typeof setInterval> | null = null
let feverStep = 0
const FEVER_BASS = [36, 36, 48, 36, 39, 39, 51, 39, 41, 41, 53, 41, 43, 43, 55, 46]
const FEVER_LEAD = [72, 0, 76, 79, 0, 76, 84, 0, 75, 0, 79, 82, 0, 79, 87, 86]

export const sfx = {
  tap() {
    tone(note(84), 0, 0.06, 'square', 0.5)
  },
  coin(delay = 0) {
    tone(note(83), delay, 0.07, 'square', 0.6)
    tone(note(88), delay + 0.07, 0.25, 'square', 0.6)
  },
  /** 正解。コンボが上がるほど高い音から始まる */
  correct(combo = 0) {
    const base = 72 + Math.min(combo, 12)
    ;[0, 4, 7, 12].forEach((s, i) => tone(note(base + s), i * 0.08, 0.18, 'square', 0.7))
    tone(note(base + 24), 0.32, 0.4, 'triangle', 0.6)
  },
  wrong() {
    tone(330, 0, 0.35, 'triangle', 0.9, 110)
    tone(220, 0.15, 0.35, 'square', 0.25, 90)
  },
  combo(level: number) {
    for (let i = 0; i < 6 + level; i++) tone(note(76 + i * 2 + level), i * 0.05, 0.1, 'square', 0.5)
  },
  fanfare() {
    const seq: [number, number, number][] = [[72, 0, 0.12], [72, 0.13, 0.12], [72, 0.26, 0.12], [77, 0.4, 0.5], [79, 0.95, 0.15], [81, 1.12, 0.15], [84, 1.3, 0.8]]
    seq.forEach(([n, s, d]) => {
      tone(note(n), s, d, 'square', 0.6)
      tone(note(n - 12), s, d, 'triangle', 0.5)
    })
  },
  /** 出題時の「じゃじゃーん」 */
  jajan() {
    tone(note(67), 0, 0.1, 'square', 0.5)
    tone(note(72), 0.12, 0.35, 'square', 0.5)
    tone(note(76), 0.12, 0.35, 'triangle', 0.5)
  },
  /** ボーナス（スロット風） */
  bonus() {
    for (let i = 0; i < 12; i++) tone(note(72 + (i % 4) * 4 + Math.floor(i / 4) * 2), i * 0.06, 0.08, 'square', 0.45)
    tone(note(96), 0.75, 0.4, 'triangle', 0.6)
  },
  /** まちがい時の「ぽよよん」 */
  boing() {
    tone(260, 0.1, 0.18, 'sine', 0.8, 520)
    tone(520, 0.28, 0.25, 'sine', 0.6, 200)
  },
  /** タップしたときの小さい音 */
  sparkle() {
    tone(note(96 + Math.floor(Math.random() * 5)), 0, 0.05, 'triangle', 0.15)
  },
  /** 選択肢を選んだ「ポコッ」 */
  select() {
    tone(note(79), 0, 0.06, 'square', 0.5)
    tone(note(86), 0.05, 0.1, 'square', 0.5)
  },
  /** カードが出てくる「シュッ」 */
  whoosh() {
    noise(0, 0.25, 0.35, 600, 5000)
  },
  /** コインがジャラジャラ */
  coinCascade(n: number) {
    for (let i = 0; i < n; i++) {
      const t = 0.3 + i * Math.max(0.035, 0.09 - i * 0.004)
      tone(note(88 + (i % 3) * 2), t, 0.06, 'square', 0.35)
      tone(note(95 + (i % 2) * 3), t + 0.04, 0.12, 'square', 0.3)
    }
  },
  /** 連続正解のたびに音が上がっていく「ピロリン↑」 */
  comboUp(c: number) {
    const b = 76 + Math.min(c, 15) * 2
    ;[0, 4, 7, 12, 16].forEach((s, i) => tone(note(b + s), 0.55 + i * 0.045, 0.09, 'square', 0.35))
  },
  /** フィーバー突入（サイレン＋ドーン） */
  /** フィーバー突入（レベルが高いほど派手） */
  /** フィーバーのレベルアップ: ダンダンダンダン！！（重い4連打 → いつものキュイーン） */
  feverStart(level = 1) {
    const root = 33 + Math.min(level, 9) // レベルが上がるほど少しずつ高く
    ;[0, 0.15, 0.3, 0.45].forEach((t, i) => {
      const last = i === 3
      tone(160, t, last ? 0.5 : 0.22, 'sine', 1, 38) // ドン（キック）
      tone(note(root + i * 2), t, last ? 0.45 : 0.16, 'sawtooth', 0.45) // ダン（低い和音）
      tone(note(root + 7 + i * 2), t, last ? 0.45 : 0.16, 'square', 0.3)
      tone(note(root + 12 + i * 2), t, last ? 0.45 : 0.16, 'square', 0.22)
      noise(t, last ? 0.5 : 0.18, last ? 0.8 : 0.55, 5000, 300, 'lowpass') // バシッ
    })
    setTimeout(() => sfx.feverRise(level), 650)
  },
  feverRise(level = 1) {
    tone(300, 0, 0.6, 'sawtooth', 0.35, 1800)
    tone(450, 0.05, 0.6, 'square', 0.25, 2400)
    tone(110, 0.62, 0.7, 'sine', 1, 40)
    noise(0.62, 0.6, 0.6, 3000, 200, 'lowpass')
    ;[72, 76, 79, 84, 88, 91, 96].forEach((n, i) => tone(note(n), 0.7 + i * (level === 3 ? 0.035 : 0.05), 0.12, 'square', 0.4))
    if (level >= 2) {
      ;[60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => tone(note(n), 1.1 + i * 0.04, 0.2, 'triangle', 0.4))
      noise(1.1, 0.5, 0.5, 400, 6000)
    }
    if (level === 3) {
      ;[72, 76, 79, 84].forEach((n) => tone(note(n), 1.5, 0.9, 'square', 0.3))
      tone(note(96), 1.5, 0.9, 'triangle', 0.4)
      for (let i = 0; i < 8; i++) noise(1.5 + i * 0.06, 0.05, 0.3, 6000, 9000, 'highpass')
    }
  },
  /** フィーバー中のBGM。3レベルごとに曲が変わる（1〜3 / 4〜6 / 7〜9） */
  startFever(level = 1) {
    if (!ctx) return
    if (feverTimer) clearInterval(feverTimer)
    feverStep = 0
    const group = level <= 3 ? 1 : level <= 6 ? 2 : 3
    const beat = 60 / [150, 180, 212][group - 1] / 2
    feverTimer = setInterval(() => {
      const i = feverStep++ % 16
      tone(note(FEVER_BASS[i] + (group >= 2 && i % 4 === 3 ? 12 : 0)), 0, beat * 0.9, 'triangle', 0.9)
      if (FEVER_LEAD[i]) tone(note(FEVER_LEAD[i]), 0, beat * 0.8, group === 1 ? 'square' : 'sawtooth', group === 1 ? 0.22 : 0.16)
      // 2つめの曲から、裏拍のアルペジオ
      if (group >= 2 && i % 2 === 1) tone(note((FEVER_LEAD[(i + 4) % 16] || 79) + 12), 0, beat * 0.5, 'square', 0.12)
      // 3つめの曲は、さらに高い音と細かいハイハット
      if (group === 3) {
        tone(note((FEVER_LEAD[(i + 8) % 16] || 84) + 24), 0, beat * 0.3, 'square', 0.1)
        noise(0, 0.02, 0.2, 9000, 12000, 'highpass')
      }
      if (i % 4 === 0) tone(120, 0, 0.12, 'sine', 0.9, 50)
      if (i % 4 === 2) noise(0, 0.08, 0.4, 2000, 6000)
      noise(0, 0.03, 0.15, 7000, 9000, 'highpass')
    }, beat * 1000)
  },
  stopFever() {
    if (feverTimer) clearInterval(feverTimer)
    feverTimer = null
  },
  /** 残り時間が少ないときの「チッ」 */
  tick(urgent = false) {
    tone(urgent ? 1760 : 1320, 0, 0.05, 'square', urgent ? 0.5 : 0.3)
  },
  /** 終了の「ピピーッ」 */
  whistle() {
    tone(2200, 0, 0.12, 'square', 0.5)
    tone(2200, 0.18, 0.12, 'square', 0.5)
    tone(2200, 0.36, 0.8, 'square', 0.5)
    tone(2210, 0.36, 0.8, 'triangle', 0.4)
  },
  /** 結果発表の「ジャン！」 */
  jan() {
    tone(note(48), 0, 0.5, 'sawtooth', 0.4)
    ;[60, 64, 67, 72].forEach((n) => tone(note(n), 0, 0.6, 'square', 0.35))
    noise(0, 0.4, 0.6, 5000, 300, 'lowpass')
  },
  drumroll(dur = 1.2) {
    for (let t = 0; t < dur; t += 0.05) tone(80 + Math.random() * 40, t, 0.04, 'sawtooth', 0.3)
  },
  /** のりものの「ブーン」（エンジンがだんだん高くなって遠ざかる） */
  vroom() {
    tone(70, 0, 0.5, 'sawtooth', 0.5, 190)
    tone(140, 0.45, 0.5, 'sawtooth', 0.4, 520)
    tone(520, 0.9, 0.4, 'sawtooth', 0.25, 220)
    noise(0.1, 0.9, 0.35, 300, 1800, 'lowpass')
  },
  /** 「ぱくっ」（かじる音） */
  munch() {
    tone(220, 0, 0.07, 'square', 0.5, 120)
    noise(0.02, 0.09, 0.55, 3000, 900)
    tone(180, 0.1, 0.06, 'triangle', 0.5, 110)
  },
  /** 「はくしょん！」（息をすって、ぷしゅっ） */
  achoo() {
    tone(500, 0, 0.35, 'sine', 0.4, 900)
    noise(0.38, 0.25, 0.7, 6000, 800)
    tone(300, 0.38, 0.2, 'triangle', 0.6, 120)
  },
  /** 「ぷはーっ」（ためていた息をはく） */
  puha() {
    noise(0, 0.6, 0.45, 3500, 700, 'bandpass')
    tone(330, 0, 0.4, 'sine', 0.3, 520)
  },
  /** カメラの「カシャッ」（シャッター。やさしい音） */
  shutter() {
    noise(0, 0.05, 0.4, 5000, 2500, 'bandpass')
    noise(0.07, 0.07, 0.35, 3500, 1800, 'bandpass')
    tone(1800, 0, 0.04, 'square', 0.18)
  },
  /** シールが「ぺたっ」と貼られる */
  paste() {
    tone(180, 0, 0.09, 'sine', 0.7, 90)
    noise(0, 0.05, 0.3, 1200, 600, 'lowpass')
  },
  /** うごくえ「がっき」: 楽器の短いフレーズ（たいこ ドンドン / ぴあの ドレミ / らっぱ パパーン / すず シャンシャン / 木琴） */
  instrument(kind: Instrument) {
    for (const p of PHRASES[kind]) {
      if (kind === 'drum') {
        tone(150, p.t, p.len, 'sine', 0.9, 55)
        noise(p.t, 0.05, 0.22, 1500, 600, 'bandpass')
      } else if (kind === 'piano') {
        tone(note(p.n), p.t, p.len, 'triangle', 0.55)
        tone(note(p.n + 12), p.t, p.len * 0.5, 'sine', 0.15)
      } else if (kind === 'trumpet') {
        tone(note(p.n), p.t, p.len, 'sawtooth', 0.28)
        tone(note(p.n + 12), p.t, p.len * 0.8, 'square', 0.08)
      } else if (kind === 'bell') {
        tone(note(p.n), p.t, p.len, 'sine', 0.3)
        tone(note(p.n + 12), p.t, p.len * 0.6, 'sine', 0.1)
        noise(p.t, 0.04, 0.12, 8000, 9000, 'highpass')
      } else {
        tone(note(p.n), p.t, p.len, 'sine', 0.5)
        tone(note(p.n) * 4, p.t, 0.07, 'sine', 0.12)
      }
    }
  },
  /** 天気: あめ（やさしいザーッ）・かぜ（ひゅーっ） */
  rain() {
    noise(0, 1.6, 0.1, 7000, 5000, 'highpass')
  },
  wind() {
    noise(0, 1.6, 0.18, 500, 1800, 'bandpass')
  },
  /** はずむ「ぽよん」 */
  bound() {
    tone(220, 0, 0.14, 'sine', 0.7, 420)
  },
  /** 「ずずーん」（地面から生えてくる。小さめの低い音） */
  rumble() {
    noise(0, 0.55, 0.3, 320, 80, 'lowpass')
    tone(70, 0, 0.5, 'sine', 0.35, 42)
  },
  /** トンカン。i=0 は「トン」（低い）、i=1 は「カン」（高い） */
  tonkan(i: number) {
    if (i % 2 === 0) {
      tone(240, 0, 0.1, 'square', 0.45, 130)
      noise(0, 0.05, 0.3, 1800, 700, 'bandpass')
    } else {
      tone(1500, 0, 0.14, 'triangle', 0.4, 1000)
      tone(2250, 0, 0.08, 'sine', 0.12)
    }
  },
  /** 花がふわっと咲く（やさしい上りの音） */
  bloom() {
    ;[72, 76, 79, 84].forEach((n, i) => tone(note(n), 0.1 + i * 0.12, 0.3, 'triangle', 0.35))
  },
  /** ねこの「にゃー」（やさしく） */
  meow() {
    tone(620, 0, 0.12, 'sine', 0.3, 880)
    tone(880, 0.12, 0.28, 'sine', 0.3, 560)
  },
  /** 「ぽんっ」（栓がぬける） */
  pon() {
    tone(260, 0, 0.1, 'sine', 0.8, 760)
    noise(0, 0.05, 0.3, 3000, 1200, 'bandpass')
  },
  /** プレゼントの箱が「パカッ」と開く */
  openBox() {
    noise(0, 0.08, 0.4, 2500, 900, 'bandpass')
    ;[76, 80, 83, 88].forEach((n, i) => tone(note(n), 0.08 + i * 0.07, 0.25, 'triangle', 0.4))
  },
  /** ひよこの「ぴよっ」 */
  peep() {
    tone(note(88), 0, 0.07, 'triangle', 0.5, note(94))
    tone(note(91), 0.1, 0.07, 'triangle', 0.5, note(96))
  },
  /** ことりの「ぴっ」。n（0から）が増えるたびに 音階が1つずつ上がる（ドレミソラ…を2オクターブ。上がりきったらまた ひくく） */
  chirp(n = 0) {
    const m = 79 + CHIRP_SCALE[Math.abs(Math.floor(n)) % CHIRP_SCALE.length]
    tone(note(m), 0, 0.06, 'sine', 0.4, note(m + 3))
    tone(note(m + 5), 0.08, 0.05, 'sine', 0.25)
  },
  /** 「キラリン」（ハプニングを はじめてみつけた。やさしい音） */
  kirarin() {
    ;[91, 95, 98, 103].forEach((n, i) => tone(note(n), i * 0.07, 0.3, 'sine', 0.35))
    tone(note(110), 0.3, 0.4, 'sine', 0.15)
  },
  /** きしゃの「ポッポー」 */
  poppo() {
    tone(note(65), 0, 0.2, 'triangle', 0.4)
    tone(note(69), 0.24, 0.4, 'triangle', 0.4)
  },
  /** くじらの しおふき（やさしいシューッ） */
  spout() {
    noise(0, 0.7, 0.22, 700, 3500, 'bandpass')
    tone(300, 0, 0.5, 'sine', 0.2, 620)
  },
  /** UFO の「ウィーン」（ゆらゆら上がる音） */
  ufo() {
    tone(330, 0, 0.5, 'sine', 0.25, 520)
    tone(335, 0, 0.5, 'triangle', 0.15, 530)
    tone(520, 0.5, 0.5, 'sine', 0.2, 330)
  },
  /** はとの「くるっぽー」 */
  coo() {
    tone(380, 0, 0.12, 'sine', 0.3, 300)
    tone(340, 0.16, 0.24, 'sine', 0.3, 260)
  },
}

// ことりの音階（半音の数。ペンタトニックで2オクターブ）
const CHIRP_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]
