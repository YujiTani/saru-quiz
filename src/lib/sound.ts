// ファミコン風の効果音を WebAudio で合成（音声ファイル不要）
import { isMuted, onMutedChange } from './settings'

let ctx: AudioContext | null = null
let master: GainNode | null = null

/** iOS はユーザー操作の中で一度鳴らさないと音が出ないので、最初のタップで呼ぶ */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = isMuted() ? 0 : 0.25
    onMutedChange((m) => master && (master.gain.value = m ? 0 : 0.25))
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
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
  drumroll(dur = 1.2) {
    for (let t = 0; t < dur; t += 0.05) tone(80 + Math.random() * 40, t, 0.04, 'sawtooth', 0.3)
  },
}
