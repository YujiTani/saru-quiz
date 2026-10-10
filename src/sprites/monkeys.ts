// ドット絵のおさるたち。文字1つ = 1ピクセル
//  . 透明  K りんかく  F 毛  L 顔・おなか  E 目  W 目のハイライト
//  M ほっぺ  N 鼻  R 口の中  T なみだ
export type Mood = 'normal' | 'happy' | 'sad'
export type CharId = 'monchan' | 'sora' | 'mint' | 'choco' | 'mandrill' | 'orangutan' | 'kinshikou' | 'rainbow' | 'gorilla'

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

type Palette = Record<string, string>
const base: Palette = { K: '#2b1a2e', E: '#2b1a2e', W: '#ffffff', N: '#2b1a2e', R: '#e8364f', F: '#ff5fa8', L: '#ffe27a', M: '#ff2d6f', T: '#5ec8ff' }

// monkey / rainbow は 16×18 の手描き行、ほかの4匹は 32×32 で組み立てる
export type Shape = 'monkey' | 'gorilla' | 'mandrill' | 'orangutan' | 'kinshikou'
export const CHARACTERS: Record<CharId, { name: string; shape: Shape; palette: Palette; rainbow?: boolean }> = {
  monchan: { name: 'もんちゃん', shape: 'monkey', palette: { ...base, F: '#ff5fa8', L: '#ffe27a', M: '#ff2d6f' } },
  // もんちゃんの色ちがい
  sora: { name: 'そらちゃん', shape: 'monkey', palette: { ...base, F: '#3f9cff', L: '#ffe6cc', M: '#ff7a9a' } },
  mint: { name: 'みんとちゃん', shape: 'monkey', palette: { ...base, F: '#2fd0a0', L: '#fff6d8', M: '#ff8ab8' } },
  choco: { name: 'ちょこちゃん', shape: 'monkey', palette: { ...base, F: '#9a5a32', L: '#ffd2a0', M: '#ff7a6a' } },
  // まんどりる: オリーブの毛・青い顔・赤い鼻すじ・黄色いあごひげ
  mandrill: { name: 'まんどりるくん', shape: 'mandrill', palette: { ...base, F: '#6f8f3a', L: '#3f8cff', P: '#6a4ad8', N: '#ff2a3a', Y: '#ffc42a', M: '#ff7a8a', S: '#ffe0c0' } },
  // おらんうーたん: 赤オレンジの長い毛・大きなほっぺ（フランジ）
  orangutan: { name: 'おらんうーたんばあば', shape: 'orangutan', palette: { ...base, F: '#e8641c', L: '#f2c48d', C: '#d89a5a', Y: '#ffdcb0', N: '#5b2a10', M: '#ff8a7a', S: '#f2c48d' } },
  // きんしこう: 金色のふさふさ・水色の顔・上向きの鼻
  kinshikou: { name: 'きんしこうちゃん', shape: 'kinshikou', palette: { ...base, F: '#ffb81c', H: '#ffe27a', L: '#7fd4ff', N: '#2b6aa8', M: '#ff8ab8', S: '#fff2c8' } },
  rainbow: { name: 'にじいろざる', shape: 'monkey', palette: { ...base, F: '#ff0000', L: '#fff6dc', M: '#ff7ab8' }, rainbow: true },
  // ごりら: もりあがった頭・太いまゆ・銀色のせなか
  gorilla: { name: 'ごりらせんせい', shape: 'gorilla', palette: { ...base, F: '#5a4a8a', B: '#3a2e60', H: '#c8c4e0', L: '#b8a8d8', N: '#2b1a2e', M: '#ff8ab8', S: '#b8a8d8' } },
}

// ---- 32×32 のドット絵を図形で組み立てる ----
const HD = 32
type Test = (x: number, y: number) => boolean
const ell = (cx: number, cy: number, rx: number, ry: number): Test => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
const rect = (x0: number, y0: number, x1: number, y1: number): Test => (x, y) => x >= x0 && x <= x1 + 1 && y >= y0 && y <= y1 + 1
const mirror = (t: Test): Test => (x, y) => t(x, y) || t(HD - x, y)

type HDShape = 'mandrill' | 'orangutan' | 'kinshikou' | 'gorilla'

function hdGrid(shape: HDShape, mood: Mood): string[][] {
  const G: string[][] = Array.from({ length: HD }, () => Array(HD).fill('.'))
  const put = (t: Test, ch: string) => {
    for (let y = 0; y < HD; y++) for (let x = 0; x < HD; x++) if (t(x + 0.5, y + 0.5)) G[y][x] = ch
  }
  const dot = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < HD && y >= 0 && y < HD) G[y][x] = ch
  }
  // 目（ふつう: 白目＋黒目＋光 / うれしい: ∩の線 / かなしい: たれ目＋なみだ）
  const eyes = (lx: number, rx: number, y: number) => {
    for (const ex of [lx, rx]) {
      if (mood === 'happy') {
        ;[[-1, 0], [0, -1], [1, -1], [2, 0]].forEach(([dx, dy]) => dot(ex + dx, y + dy, 'K'))
      } else if (mood === 'sad') {
        ;[[-1, -1], [0, 0], [1, 0], [2, 0]].forEach(([dx, dy]) => dot(ex + dx, y + dy, 'K'))
        dot(ex, y + 2, 'T')
        dot(ex, y + 3, 'T')
      } else {
        put(rect(ex - 1, y - 1, ex + 2, y + 1), 'W')
        put(rect(ex, y - 1, ex + 1, y + 1), 'E')
        dot(ex + 1, y - 1, 'W')
      }
    }
  }
  const mouth = (cx: number, y: number, w: number) => {
    if (mood === 'happy') {
      put(ell(cx, y + 0.5, w, 1.8), 'R')
    } else if (mood === 'sad') {
      for (let dx = -w + 1; dx < w; dx++) dot(Math.round(cx + dx - 0.5), y + (Math.abs(dx) < w - 1 ? 0 : 1), 'K')
    } else {
      for (let dx = -w + 1; dx < w; dx++) dot(Math.round(cx + dx - 0.5), y + (Math.abs(dx) < w - 1 ? 1 : 0), 'K')
    }
  }

  // 共通のからだ（体・腕・足）
  const body = (wide = 9) => {
    put(ell(16, 26, wide, 6.2), 'F')
    put(mirror(ell(6.5, 25, 3.2, 5)), 'F')
    put(ell(16, 26.5, wide - 4, 4.2), 'S')
    put(mirror(ell(11, 30.4, 3.6, 1.8)), 'S')
  }

  if (shape === 'mandrill') {
    body()
    put(mirror(ell(5, 11, 3, 3.4)), 'F') // 耳
    put(mirror(ell(5, 11, 1.5, 2)), 'M')
    put(ell(16, 11, 10, 9.6), 'F') // 頭
    put(ell(16, 2.6, 4, 2), 'F') // 頭のてっぺんの毛
    put(ell(16, 15.5, 6, 7.4), 'L') // 青い顔（長いマズル）
    put(mirror(rect(11, 12, 11, 19)), 'P') // ほっぺのみぞ
    put(mirror(rect(13, 13, 13, 18)), 'P')
    put(ell(16, 15, 1.6, 6.2), 'N') // 赤い鼻すじ
    put(ell(16, 20.6, 2.8, 1.4), 'N') // 鼻先
    put(ell(16, 23.4, 5.2, 2.6), 'Y') // 黄色いあごひげ
    put(rect(9, 7, 22, 7), 'K') // 眉
    eyes(12, 19, 9)
    mouth(16, 22, 3)
  } else if (shape === 'orangutan') {
    body(10)
    put(mirror(ell(4, 24, 3.2, 6.5)), 'F') // 長い毛の腕
    put(ell(16, 10.5, 10, 9.4), 'F') // 頭
    put(ell(16, 2.2, 5.5, 2.4), 'F') // とさか毛
    put(mirror(ell(6.4, 14, 3.6, 5.2)), 'C') // 大きなほっぺ（フランジ）
    put(ell(16, 13.4, 7.2, 7.4), 'L') // 顔
    put(ell(16, 18, 4.6, 3), 'Y') // 口まわり
    put(rect(14, 14, 14, 14), 'N')
    put(rect(17, 14, 17, 14), 'N')
    eyes(12, 19, 11)
    mouth(16, 19, 3)
  } else if (shape === 'kinshikou') {
    body()
    // ふさふさの毛（頭のまわりのとげ）
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      put(ell(16 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 9.5, 2.6, 2.6), 'F')
    }
    put(ell(16, 12, 10.5, 9.8), 'F')
    put(ell(16, 4.5, 6, 2.6), 'H') // 明るい頭の毛
    put(ell(16, 14, 6.4, 6.8), 'L') // 水色の顔
    put(ell(16, 14.6, 1.6, 1.1), 'N') // 上向きの小さな鼻
    put(ell(16, 18.6, 2.8, 1.3), 'M') // ピンクのくちびる
    put(mirror(ell(7, 18, 2.4, 2.2)), 'H') // ほっぺの毛
    eyes(12, 19, 11)
    if (mood !== 'normal') mouth(16, 18, 3)
  } else {
    // ごりら
    put(ell(16, 25, 13, 7), 'F') // 大きな肩
    put(ell(16, 21, 9, 3), 'H') // 銀色のせなか（肩の上）
    put(mirror(ell(4.6, 26, 3.8, 6)), 'F') // 太い腕
    put(mirror(ell(5, 31, 3.6, 1.6)), 'B') // こぶし
    put(ell(16, 27.5, 6, 4), 'L') // むね
    put(ell(16, 12, 9.4, 9.2), 'F') // 頭
    put(ell(16, 3.4, 5.6, 3.4), 'F') // もりあがった頭
    put(mirror(ell(7.5, 12, 1.8, 2.2)), 'F') // 耳
    put(ell(16, 14.6, 6.6, 6), 'L') // 顔
    put(rect(9, 8, 22, 9), 'B') // 太いまゆ
    put(ell(16, 15.4, 3.2, 2), 'S') // 鼻のまわり
    put(rect(14, 15, 14, 16), 'N') // 大きな鼻の穴
    put(rect(17, 15, 17, 16), 'N')
    eyes(12, 19, 11)
    mouth(16, 18, 3)
  }
  // 外側の輪郭
  const out = G.map((r) => [...r])
  for (let y = 0; y < HD; y++)
    for (let x = 0; x < HD; x++) {
      if (G[y][x] !== '.') continue
      const near = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => nx >= 0 && nx < HD && ny >= 0 && ny < HD && G[ny][nx] !== '.')
      if (near) out[y][x] = 'K'
    }
  return out
}

// 色を明るく / 暗く
function shadeColor(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))))
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`
}
const NO_SHADE = new Set(['K', 'E', 'W', 'T', 'R'])

const cache = new Map<string, string>()

/** 16×18（もんちゃん・にじいろざる）の行 */
function lowRows(mood: Mood): string[] {
  return MONKEY.map((r, y) => MOODS[mood][y] ?? r)
}

export function spriteUrl(char: CharId, mood: Mood = 'normal'): string {
  const key = `${char}/${mood}`
  const hit = cache.get(key)
  if (hit) return hit
  const def = CHARACTERS[char]
  const hd = def.shape !== 'monkey'
  const grid = hd ? hdGrid(def.shape as HDShape, mood) : lowRows(mood).map((r) => [...r])
  const H = grid.length
  const W = grid[0].length
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  const at = (x: number, y: number) => (x >= 0 && x < W && y >= 0 && y < H ? grid[y][x] : '.')
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = grid[y][x]
      if (!ch || ch === '.') continue
      let color = ch === 'F' && def.rainbow ? `hsl(${(y * 360) / H}, 95%, 58%)` : def.palette[ch] ?? '#f0f'
      // 32×32 は右下に影、左上にハイライトを入れて立体感を出す
      // 影とハイライトは外側の縁（輪郭のとなり）だけに入れる。内側の境目は塗らない
      if (hd && !NO_SHADE.has(ch) && color.startsWith('#')) {
        const edge = (dx: number, dy: number) => ['.', 'K'].includes(at(x + dx, y + dy))
        if (edge(1, 0) || edge(0, 1) || edge(1, 1) || edge(2, 0) || edge(0, 2)) color = shadeColor(color, -0.25)
        else if (edge(-1, 0) || edge(0, -1) || edge(-2, 0) || edge(0, -2)) color = shadeColor(color, 0.32)
      }
      g.fillStyle = color
      g.fillRect(x, y, 1, 1)
    }
  const url = canvas.toDataURL()
  cache.set(key, url)
  return url
}
