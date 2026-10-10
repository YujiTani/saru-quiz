// ファミコン風の効果音を WebAudio で合成（音声ファイル不要）
import { isMuted, onMutedChange } from './settings'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let voiceGain: GainNode | null = null
let voiceSrc: AudioBufferSourceNode | null = null
const buffers = new Map<string, Promise<AudioBuffer>>()

/** iOS はユーザー操作の中で一度鳴らさないと音が出ないので、最初のタップで呼ぶ */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = isMuted() ? 0 : 0.25
    voiceGain = ctx.createGain()
    voiceGain.gain.value = isMuted() ? 0 : 1
    onMutedChange((m) => {
      if (master) master.gain.value = m ? 0 : 0.25
      if (voiceGain) voiceGain.gain.value = m ? 0 : 1
    })
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

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 1, slideTo?: number) {
  if (!ctx || !master) return
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

const note = (n: number) => 440 * Math.pow(2, (n - 69) / 12) // MIDI番号 → Hz

let noiseBuf: AudioBuffer | null = null
/** ノイズ（シュッ・ドラム用） */
function noise(start: number, dur: number, vol = 0.5, from = 800, to = 8000, type: BiquadFilterType = 'bandpass') {
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
  src.connect(f).connect(g).connect(master)
  src.start(t)
  src.stop(t + dur + 0.02)
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
  feverStart() {
    tone(300, 0, 0.6, 'sawtooth', 0.35, 1800)
    tone(450, 0.05, 0.6, 'square', 0.25, 2400)
    tone(110, 0.62, 0.7, 'sine', 1, 40)
    noise(0.62, 0.6, 0.6, 3000, 200, 'lowpass')
    ;[72, 76, 79, 84, 88, 91, 96].forEach((n, i) => tone(note(n), 0.7 + i * 0.05, 0.12, 'square', 0.4))
  },
  startFever() {
    if (feverTimer || !ctx) return
    feverStep = 0
    const beat = 60 / 150 / 2
    feverTimer = setInterval(() => {
      const i = feverStep++ % 16
      tone(note(FEVER_BASS[i]), 0, beat * 0.9, 'triangle', 0.9)
      if (FEVER_LEAD[i]) tone(note(FEVER_LEAD[i]), 0, beat * 0.8, 'square', 0.22)
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
}
