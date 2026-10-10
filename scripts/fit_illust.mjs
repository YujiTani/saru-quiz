// イラストの位置と大きさをそろえる（描かれている範囲を測って、中央・同じ余白に拡大縮小する）
// 使い方: node scripts/fit_illust.mjs            … public/illust/*.svg を全部
//         node scripts/fit_illust.mjs id1 id2 …  … 指定したものだけ
// 絵は <g data-fit> で包むだけなので、何度実行しても同じ結果になる
import fs from 'fs'
import { launch } from './browser.mjs'

const DIR = 'public/illust'
const BOX = 216 // 256 のうち絵が入る大きさ（余白 20px）
const STROKE = 4 // getBBox は線の太さを含まないぶんの足し
const MAX_SCALE = 1.6 // 小さすぎる絵を拡大しすぎない（線が太くなりすぎるので）

const ids = process.argv.slice(2)
const files = (ids.length ? ids.map((i) => `${i}.svg`) : fs.readdirSync(DIR).filter((f) => f.endsWith('.svg'))).map((f) => `${DIR}/${f}`)

const OPEN = /^(<svg[^>]*>)<g data-fit="1" transform="[^"]*">/
const unwrap = (s) => (OPEN.test(s) ? s.replace(OPEN, '$1').replace(/<\/g><\/svg>\s*$/, '</svg>') : s)

const browser = await launch()
const page = await browser.newPage()
await page.setContent('<html><body></body></html>')
let changed = 0
try {
  for (const file of files) {
    const src = unwrap(fs.readFileSync(file, 'utf8').trim())
    const box = await page.evaluate((svg) => {
      document.body.innerHTML = svg
      const el = document.body.querySelector('svg')
      el.setAttribute('width', '256')
      el.setAttribute('height', '256')
      const b = el.getBBox()
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    }, src)
    if (!box.w || !box.h) {
      console.warn(`⚠️ ${file}: 範囲が測れません`)
      continue
    }
    const x = box.x - STROKE, y = box.y - STROKE, w = box.w + STROKE * 2, h = box.h + STROKE * 2
    const s = Math.min(BOX / w, BOX / h, MAX_SCALE)
    const tx = 128 - (x + w / 2) * s
    const ty = 128 - (y + h / 2) * s
    const r = (v) => Math.round(v * 1000) / 1000
    // ほぼ動かないものは そのまま
    const out = Math.abs(s - 1) < 0.02 && Math.abs(tx) < 2 && Math.abs(ty) < 2
      ? src
      : src.replace(/^(<svg[^>]*>)/, `$1<g data-fit="1" transform="matrix(${r(s)} 0 0 ${r(s)} ${r(tx)} ${r(ty)})">`).replace(/<\/svg>$/, '</g></svg>')
    if (out !== fs.readFileSync(file, 'utf8').trim()) {
      fs.writeFileSync(file, out)
      changed++
    }
  }
} finally {
  await browser.close()
}
console.log(`✅ ${files.length}枚を確認、${changed}枚を中央・同じ大きさに調整`)
