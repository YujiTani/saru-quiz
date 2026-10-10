// アプリアイコン（ドット絵のもんちゃん）を public/icons/ に PNG で書き出す
import fs from 'fs'
import { launch } from './browser.mjs'

const src = fs.readFileSync('src/sprites/monkeys.ts', 'utf8')
const rows = [...src.match(/const MONKEY = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const happy = { 6: 'KLKLELLLLLLELKLK', 7: 'KLKELELLLLELEKLK', 10: '..KLKRRRRRRKLK..', 11: '...KLKRRRRKLK...' }
const pal = { K: '#2b1a2e', E: '#2b1a2e', W: '#fff', N: '#2b1a2e', R: '#e8364f', F: '#ff5fa8', L: '#ffe27a', M: '#ff2d6f' }
const rects = rows.map((r, y) => [...(happy[y] ?? r)].map((ch, x) => (ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[ch]}"/>`)).join('')).join('')
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad - 1} ${16 + pad * 2} ${16 + pad * 2}" shape-rendering="crispEdges">
<rect x="${-pad}" y="${-pad - 1}" width="${16 + pad * 2}" height="${16 + pad * 2}" fill="#3a1c71"/>
<circle cx="8" cy="8" r="${8 + pad * 0.6}" fill="#ffd400" opacity=".9"/>${rects}</svg>`

fs.mkdirSync('public/icons', { recursive: true })
const browser = await launch()
const page = await browser.newPage()
for (const [name, size, pad] of [['icon-192.png', 192, 3], ['icon-512.png', 512, 3], ['apple-touch-icon.png', 180, 3], ['maskable-512.png', 512, 6]]) {
  await page.setViewport({ width: size, height: size })
  await page.setContent(`<body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.screenshot({ path: `public/icons/${name}`, clip: { x: 0, y: 0, width: size, height: size } })
}
await browser.close()
console.log('icons → public/icons/')
