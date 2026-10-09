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
const base: Palette = { K: '#2b1a2e', E: '#2b1a2e', W: '#ffffff', N: '#2b1a2e', R: '#e8364f', T: '#5ec8ff' }

export const CHARACTERS: Record<CharId, { name: string; palette: Palette; rainbow?: boolean; gorilla?: boolean }> = {
  monchan: { name: 'もんちゃん', palette: { ...base, F: '#ff5fa8', L: '#ffe27a', M: '#ff2d6f' } },
  mandrill: { name: 'まんどりるくん', palette: { ...base, F: '#2fb85a', L: '#4fb4ff', M: '#ff3a3a', N: '#ff3a3a' } },
  orangutan: { name: 'おらんうーたんばあば', palette: { ...base, F: '#ff8a1c', L: '#ffd2a0', M: '#ff5a3c' } },
  kinshikou: { name: 'きんしこうちゃん', palette: { ...base, F: '#ffc400', L: '#9fe3ff', M: '#ff7ab8' } },
  rainbow: { name: 'にじいろざる', palette: { ...base, F: '#ff0000', L: '#fff6dc', M: '#ff7ab8' }, rainbow: true },
  gorilla: { name: 'ごりらせんせい', palette: { ...base, F: '#7b4dff', L: '#d0c0ff', M: '#ff7ab8' }, gorilla: true },
}

const cache = new Map<string, string>()

export function spriteUrl(char: CharId, mood: Mood = 'normal'): string {
  const key = `${char}/${mood}`
  const hit = cache.get(key)
  if (hit) return hit
  const def = CHARACTERS[char]
  const rows = (def.gorilla ? GORILLA : MONKEY).map((r, y) => (def.gorilla ? GORILLA_MOODS : MOODS)[mood][y] ?? r)
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
