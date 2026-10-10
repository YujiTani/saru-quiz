// ドット絵のおさるたち。文字1つ = 1ピクセル
//  . 透明  K りんかく  F 毛  L 顔・おなか  E 目  W 目のハイライト
//  M ほっぺ  N 鼻  R 口の中  T なみだ
export type Mood = 'normal' | 'happy' | 'sad'
export type CharId = 'monchan' | 'mandrill' | 'orangutan' | 'kinshikou' | 'rainbow' | 'gorilla'

const MONKEY = [
  '.....KKKKKK.....',
  '...KKFFFFFFKK...',
  '..KFFFFFFFFFFK..',
  '.KFFFFFFFFFFFFK.',
  'KKFFLLLFFLLLFFKK',
  'KLKLLLLLLLLLLKLK',
  'KLKLWELLLLWELKLK',
  'KLKLEELLLLEELKLK',
  '.KKMLLLLLLLLMKK.',
  '..KLLLLNNLLLLK..',
  '..KLLKLLLLKLLK..',
  '...KLLKKKKLLK...',
  '....KKKKKKKK....',
  '...KFFFLLFFFK...',
  '..KFFKLLLLKFFK..',
  '..KFFKLLLLKFFKK.',
  '...KFFFFFFFFKFK.',
  '...KLLK..KLLKK..',
]

const MOODS: Record<Mood, Record<number, string>> = {
  normal: {},
  happy: {
    6: 'KLKLELLLLLLELKLK',
    7: 'KLKELELLLLELEKLK',
    10: '..KLKRRRRRRKLK..',
    11: '...KLKRRRRKLK...',
  },
  sad: {
    6: 'KLKLLLLLLLLLLKLK',
    7: 'KLKEEELLLLEEEKLK',
    8: '.KKLTLLLLLLTLKK.',
    10: '..KLLLKKKKLLLK..',
    11: '...KLKLLLLKLK...',
  },
}

const GORILLA = [
  '....KKKKKKKK....',
  '...KFFFFFFFFK...',
  '..KFFFFFFFFFFK..',
  '..KFLLLLLLLLFK..',
  '.KFLWELLLLWELFK.',
  '.KFLEELLLLEELFK.',
  '.KFLLLLNNLLLLFK.',
  '.KFLLLNLLNLLLFK.',
  '.KFMLLLLLLLLMFK.',
  '..KLLKKKKKKLLK..',
  '.KKKLLLLLLLLKKK.',
  'KFFFKKKKKKKKFFFK',
  'KFFFFFFFFFFFFFFK',
  'KFFFFFLLLLFFFFFK',
  'KLLKFFLLLLFFKLLK',
  'KKK.KFFFFFFK.KKK',
  '....KFFKKFFK....',
  '....KKK..KKK....',
]

const GORILLA_MOODS: Record<Mood, Record<number, string>> = {
  normal: {},
  happy: { 4: '.KFLLELLLLELLFK.', 5: '.KFLELELLELELFK.', 9: '..KLLKRRRRKLLK..' },
  sad: { 4: '.KFLLLLLLLLLLFK.', 5: '.KFLEEELLEEELFK.', 8: '.KFTLLLLLLLLTFK.' },
}

type Palette = Record<string, string>
const base: Palette = { K: '#2b1a2e', E: '#2b1a2e', W: '#ffffff', N: '#2b1a2e', R: '#e8364f', F: '#ff5fa8', L: '#ffe27a', M: '#ff2d6f', T: '#5ec8ff' }

// 形の種類。monkey（まるい顔）/ gorilla（こわい眉）/ 顔の形から作るもの（マンドリル・オランウータン・キンシコウ）
export type Shape = 'monkey' | 'gorilla' | 'mandrill' | 'orangutan' | 'kinshikou'
export const CHARACTERS: Record<CharId, { name: string; shape: Shape; palette: Palette; rainbow?: boolean }> = {
  monchan: { name: 'もんちゃん', shape: 'monkey', palette: { ...base, F: '#ff5fa8', L: '#ffe27a', M: '#ff2d6f' } },
  mandrill: { name: 'まんどりるくん', shape: 'mandrill', palette: { ...base, F: '#2fb85a', L: '#4fb4ff', M: '#ff3a3a', N: '#ff3a3a' } },
  orangutan: { name: 'おらんうーたんばあば', shape: 'orangutan', palette: { ...base, F: '#ff8a1c', L: '#ffd2a0', M: '#ff5a3c', N: '#5b2a10' } },
  kinshikou: { name: 'きんしこうちゃん', shape: 'kinshikou', palette: { ...base, F: '#ffc400', L: '#9fe3ff', M: '#ff7ab8' } },
  rainbow: { name: 'にじいろざる', shape: 'monkey', palette: { ...base, F: '#ff0000', L: '#fff6dc', M: '#ff7ab8' }, rainbow: true },
  gorilla: { name: 'ごりらせんせい', shape: 'gorilla', palette: { ...base, F: '#7b4dff', L: '#d0c0ff', M: '#ff7ab8' } },
}

// 顔の形を楕円で組み立てる（16×18 のドット）。輪郭は自動で黒く縁取る
const GW = 16
const GH = 18
type Test = (x: number, y: number) => boolean
const ell = (cx: number, cy: number, rx: number, ry: number): Test => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

function procRows(shape: Exclude<Shape, 'monkey' | 'gorilla'>, mood: Mood): string[] {
  const G: string[][] = Array.from({ length: GH }, () => Array(GW).fill('.'))
  const put = (test: Test, ch: string) => {
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (test(x + 0.5, y + 0.5)) G[y][x] = ch
  }
  if (shape === 'mandrill') {
    put(ell(8, 8.5, 6.6, 7.6), 'F') // 緑の毛
    put(ell(8, 10.8, 4.4, 5.2), 'L') // 青い顔
    put(ell(8, 11, 1.1, 3.6), 'N') // 赤い鼻すじ
    put(ell(4.4, 11.6, 1.5, 2.0), 'M') // 赤いほっぺのしま
    put(ell(11.6, 11.6, 1.5, 2.0), 'M')
    put(ell(8, 15, 3.2, 1.6), 'F') // あごのひげ
    put(ell(6, 8.6, 1.6, 1.5), 'W')
    put(ell(10, 8.6, 1.6, 1.5), 'W')
    put(ell(6.2, 8.8, 0.7, 0.8), 'E')
    put(ell(9.8, 8.8, 0.7, 0.8), 'E')
  } else if (shape === 'orangutan') {
    put(ell(8, 8, 7, 7.3), 'F') // オレンジの毛
    put(ell(2.4, 10.5, 2.4, 3.8), 'L') // 大きなほっぺ
    put(ell(13.6, 10.5, 2.4, 3.8), 'L')
    put(ell(8, 10.2, 4.7, 4.9), 'L') // 顔
    put(ell(6, 8.2, 1.1, 1.3), 'E')
    put(ell(10, 8.2, 1.1, 1.3), 'E')
    put(ell(8, 11.8, 1.2, 0.9), 'N')
  } else {
    put(ell(8, 8.4, 6.2, 7.6), 'F') // 金色の毛
    put(ell(8, 15.4, 4.2, 2.4), 'F') // ふさふさのえり
    put(ell(8, 9.8, 4.2, 4.6), 'L') // 水色の顔
    put(ell(6, 8.6, 1.2, 1.3), 'E')
    put(ell(10, 8.6, 1.2, 1.3), 'E')
    put(ell(8, 11.2, 0.8, 0.6), 'N')
  }
  // からだ（肩から下）
  put(ell(8, 17.6, 5.4, 3.4), shape === 'kinshikou' ? 'F' : shape === 'mandrill' ? 'L' : 'F')
  // 輪郭（外側だけを黒く縁取る）
  const out = G.map((r) => [...r])
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      if (G[y][x] !== '.') continue
      const near = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => nx >= 0 && nx < GW && ny >= 0 && ny < GH && G[ny][nx] !== '.')
      if (near) out[y][x] = 'K'
    }
  // 表情
  if (mood === 'happy') {
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        if (out[y][x] === 'E' || out[y][x] === 'W') out[y][x] = 'K' // 目をとじる
        if (ell(8, 13.5, 1.8, 1.1)(x + 0.5, y + 0.5) && out[y][x] !== '.' && out[y][x] !== 'K') out[y][x] = 'R' // 口
      }
  } else if (mood === 'sad') {
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++)
        if ((x === 5 || x === 10) && y === 11 && out[y][x] !== '.' && out[y][x] !== 'K') out[y][x] = 'T' // なみだ
  }
  return out.map((r) => r.join(''))
}

const cache = new Map<string, string>()

/** キャラクターの形を文字の行で返す（表情つき） */
function rowsFor(char: CharId, mood: Mood): string[] {
  const def = CHARACTERS[char]
  if (def.shape === 'mandrill' || def.shape === 'orangutan' || def.shape === 'kinshikou') return procRows(def.shape, mood)
  const base = def.shape === 'gorilla' ? GORILLA : MONKEY
  const moods = def.shape === 'gorilla' ? GORILLA_MOODS : MOODS
  return base.map((r, y) => moods[mood][y] ?? r)
}

export function spriteUrl(char: CharId, mood: Mood = 'normal'): string {
  const key = `${char}/${mood}`
  const hit = cache.get(key)
  if (hit) return hit
  const def = CHARACTERS[char]
  const rows = rowsFor(char, mood)
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = rows.length
  const g = canvas.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x]
      if (!ch || ch === '.') continue
      g.fillStyle = ch === 'F' && def.rainbow ? `hsl(${(y * 360) / rows.length}, 95%, 58%)` : def.palette[ch] ?? '#f0f'
      g.fillRect(x, y, 1, 1)
    }
  })
  const url = canvas.toDataURL()
  cache.set(key, url)
  return url
}
