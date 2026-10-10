// うごくえ「がっき・おと」: 単語から楽器を見分けて、短いフレーズを決める（純粋。音を鳴らすのは sound.ts の sfx.instrument）
export type Instrument = 'drum' | 'piano' | 'trumpet' | 'bell' | 'marimba'

// 単語の id（英語）で見分ける。どれにも当たらなければ 木琴
const BY_ID: [RegExp, Instrument][] = [
  [/^(drum|cymbals|castanets)$/, 'drum'],
  [/^(piano|melodica|accordion|harmonica)$/, 'piano'],
  [/^(trumpet|saxophone)$/, 'trumpet'],
  [/^(jingle-bell|tambourine|triangle-instrument|maracas)$/, 'bell'],
]

export function instrumentOf(q: { id: string } | undefined): Instrument {
  const id = q?.id ?? ''
  return BY_ID.find(([re]) => re.test(id))?.[1] ?? 'marimba'
}

/** フレーズの1音。t: はじまり（秒）、n: MIDI番号（たいこは使わない）、len: 長さ（秒） */
export type PhraseNote = { t: number; n: number; len: number }

// たいこ: ドン ドン ドドン / ぴあの: ドレミ / らっぱ: パパーン / すず: シャンシャン / 木琴: ぽこぽこぽこ
export const PHRASES: Record<Instrument, PhraseNote[]> = {
  drum: [
    { t: 0, n: 0, len: 0.25 },
    { t: 0.4, n: 0, len: 0.25 },
    { t: 0.8, n: 0, len: 0.2 },
    { t: 0.95, n: 0, len: 0.3 },
  ],
  piano: [
    { t: 0, n: 72, len: 0.4 },
    { t: 0.32, n: 74, len: 0.4 },
    { t: 0.64, n: 76, len: 0.8 },
  ],
  trumpet: [
    { t: 0, n: 67, len: 0.16 },
    { t: 0.2, n: 67, len: 0.16 },
    { t: 0.42, n: 72, len: 0.7 },
  ],
  bell: [
    { t: 0, n: 96, len: 0.3 },
    { t: 0.1, n: 99, len: 0.3 },
    { t: 0.2, n: 103, len: 0.3 },
    { t: 0.5, n: 96, len: 0.3 },
    { t: 0.6, n: 99, len: 0.3 },
    { t: 0.7, n: 103, len: 0.4 },
  ],
  marimba: [
    { t: 0, n: 72, len: 0.3 },
    { t: 0.16, n: 76, len: 0.3 },
    { t: 0.32, n: 79, len: 0.3 },
    { t: 0.48, n: 84, len: 0.3 },
    { t: 0.7, n: 79, len: 0.3 },
    { t: 0.86, n: 84, len: 0.5 },
  ],
}

/** フレーズぜんたいの長さ（秒） */
export const phraseLength = (kind: Instrument): number => {
  const p = PHRASES[kind]
  return Math.max(...p.map((x) => x.t + x.len))
}
