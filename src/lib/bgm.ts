// おさるバンドの ふだんのBGM。曲のデータと、楽器・テンポを決める純粋な関数（音を鳴らすのは sound.ts）
// 旋律はぜんぶオリジナル。1ステップ = 8分音符、曲は ぐるぐる くりかえす

/** 楽器（重なる順）。at は、その楽器が加わる E（クリアまでの進み具合） */
export const BGM_LAYERS = [
  { id: 'drum', at: 0, icon: '🥁', name: 'たいこ' },
  { id: 'bass', at: 0.2, icon: '🎸', name: 'べーす' },
  { id: 'marimba', at: 0.4, icon: '🎹', name: 'まりんば' },
  { id: 'lead', at: 0.6, icon: '🎺', name: 'らっぱ' },
  { id: 'choir', at: 0.8, icon: '🎤', name: 'こーらす' },
] as const
export type LayerId = (typeof BGM_LAYERS)[number]['id']

const EPS = 1e-9

/** E のときに鳴らす楽器（たいこは いつも。E が上がるほど増える） */
export function layersAt(E: number): LayerId[] {
  return BGM_LAYERS.filter((l) => E + EPS >= l.at).map((l) => l.id)
}

/** テンポ（4分音符の BPM）。E=0 で 100、E=1 で 124。曲ごとの倍率をかける */
export function bpmAt(E: number, scale = 1): number {
  const e = Math.max(0, Math.min(1, E))
  return (100 + 24 * e) * scale
}

/** 1ステップ（8分音符）の秒数 */
export const stepSec = (bpm: number) => 30 / bpm

/** 音のならび。n は MIDI 番号（和音なら複数）、len は ステップ数。休みは null */
export type Step = { n: number[]; len: number } | null

export type Song = {
  id: string
  /** テンポの倍率（こもりうたは ゆっくり） */
  bpmScale: number
  /** 1小節のステップ数（4拍子は 8、3拍子は 6） */
  barSteps: number
  /** 曲ぜんたいのステップ数 */
  steps: number
  /** 音をみじかく切る（かわいいスタッカート） */
  staccato: boolean
  /** たいこ。1小節ぶんの文字を小節の数だけ。K=キック h=ハイハット d=どん k=かっ .=休み */
  drums: string[]
  bass: Step[]
  marimba: Step[]
  lead: Step[]
  choir: Step[]
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** 'C4' → 60 */
export function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)
  if (!m) throw new Error(`音の名前がおかしい: ${name}`)
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}

/** 和音の名前 → 構成音 */
export const CHORDS: Record<string, number[]> = {
  C: [60, 64, 67],
  F: [65, 69, 72],
  G: [67, 71, 74],
  Am: [57, 60, 64],
  Dm: [62, 65, 69],
  Em: [64, 67, 71],
}

/**
 * 楽譜の書き方（空白で区切る）: 'C5:2 E5 -:2 Am:4'
 * 音の名前（C5）か和音の名前（Am）に、:ステップ数（なければ1）。- は休み
 */
export function parseTrack(text: string): Step[] {
  const out: Step[] = []
  for (const tok of text.trim().split(/\s+/)) {
    const [name, l] = tok.split(':')
    const len = l ? Number(l) : 1
    if (!(len >= 1)) throw new Error(`長さがおかしい: ${tok}`)
    const n = name === '-' ? null : CHORDS[name] ?? [midi(name)]
    out.push(n ? { n, len } : null)
    for (let i = 1; i < len; i++) out.push(null)
  }
  return out
}

/** うらはく（2・4・6・8ステップめ）にだけ和音をたたく */
const off = (c: string, n = 4) => Array.from({ length: n }, () => `- ${c}`).join(' ')

function song(p: { id: string; bpmScale?: number; barSteps?: number; staccato?: boolean; drums: string[]; bass: string; marimba: string; lead: string; choir: string }): Song {
  const bass = parseTrack(p.bass)
  return {
    id: p.id,
    bpmScale: p.bpmScale ?? 1,
    barSteps: p.barSteps ?? 8,
    steps: bass.length,
    staccato: p.staccato ?? false,
    drums: p.drums,
    bass,
    marimba: parseTrack(p.marimba),
    lead: parseTrack(p.lead),
    choir: parseTrack(p.choir),
  }
}

/** じゃんぐるまーち（4拍子・ドミソの行進） */
const march = song({
  id: 'march',
  drums: ['K.h.K.h.', 'K.h.K.h.', 'K.h.K.h.', 'K.h.KhKh'],
  bass: 'C3:2 G2:2 C3:2 G2:2  F2:2 C3:2 F2:2 C3:2  C3:2 C3:2 G2:2 G2:2  G2:2 G2:2 C3:4',
  marimba: `${off('C')}  ${off('F')}  ${off('C', 2)} ${off('G', 2)}  ${off('G', 2)} ${off('C', 2)}`,
  lead: 'C5 E5 G5 E5 C5 E5 G5:2  A5:2 G5 E5 F5:2 E5 D5  E5 G5 C6:2 B5 G5 A5:2  G5 E5 D5 E5 C5:3 -',
  choir: 'C:8  F:8  C:4 G:4  G:4 C:4',
})

/** おまつり（ペンタトニック・たいこ多め） */
const matsuri = song({
  id: 'matsuri',
  drums: ['dhkdhdkh', 'dhkdhdkk', 'dhkdhdkh', 'dkdkdhkd'],
  bass: 'C3:2 G2:2 C3:2 G2:2  C3:2 G2:2 C3:2 G2:2  A2:2 E3:2 A2:2 E3:2  G2:2 G2:2 C3:4',
  marimba: `${off('C')}  ${off('C')}  ${off('Am')}  ${off('Am', 2)} ${off('C', 2)}`,
  lead: 'A4:2 G4 E4 G4:2 E4:2  D4 E4 G4 A4 G4:2 E4:2  A4:2 C5:2 A4 G4 E4:2  D4 E4 D4 C4 D4:2 -:2',
  choir: 'C:8  C:8  Am:8  Am:4 C:4',
})

/** おもちゃのぎょうれつ（かわいいスタッカート） */
const omocha = song({
  id: 'omocha',
  bpmScale: 1.05,
  staccato: true,
  drums: ['K.hhK.hh', 'K.hhK.hh', 'K.hhK.hh', 'K.hhKhKh'],
  bass: 'C3 - G2 - C3 - G2 -  G2 - D3 - G2 - D3 -  C3 - G2 - C3 - G2 -  F2 - G2 - C3:2 -:2',
  marimba: `${off('C')}  ${off('G')}  ${off('C')}  - F - G - C - -`,
  lead: 'E5 - E5 - G5 - E5 -  D5 - D5 - F5 - D5 -  C5 E5 G5 E5 C5 E5 G5 -  A5 G5 F5 E5 D5 - C5:2',
  choir: 'C:8  G:8  C:8  F:2 G:2 C:4',
})

/** ねんねのこもりうた（ゆっくり・3拍子） */
const komoriuta = song({
  id: 'komoriuta',
  bpmScale: 0.62,
  barSteps: 6,
  drums: ['K.h.h.', 'K.h.h.', 'K.h.h.', 'K.h.h.', 'K.h.h.', 'K.h.h.', 'K.h.h.', 'K.h.h.'],
  bass: 'C3:6  G2:6  F2:6  C3:6  C3:6  F2:3 C3:3  G2:6  C3:6',
  marimba: 'C - C - C -  G - G - G -  F - F - F -  C - C - C -  C - C - C -  F - - C - -  G - G - G -  C - C - C -',
  lead: 'E5:2 G5:2 E5:2  D5:3 C5:3  E5:2 A5:2 G5:2  E5:2 D5:2 C5:2  G5:2 E5:2 G5:2  A5:3 G5:3  E5:2 F5:2 D5:2  C5:4 -:2',
  choir: 'C:6  G:6  F:6  C:6  C:6  F:3 C:3  G:6  C:6',
})

export const SONGS: Record<string, Song> = { march, matsuri, omocha, komoriuta }

/** 演出の id（'ongaku:march'）から曲を取り出す。知らない id は march */
export const songOf = (showId: string): Song => SONGS[showId.replace(/^ongaku:/, '')] ?? march
