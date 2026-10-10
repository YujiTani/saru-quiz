// スクショを1枚に並べる（目で確かめる用）。使い方: node scripts/contact_sheet.mjs 出力.png [--w 260] [--top 0.4] 画像…
// --top を付けると、各画像から その割合の高さだけ切り出す。--from で切り出しの はじまり（上からの割合）を決める
import fs from 'fs'
import os from 'os'
import path from 'path'
import { launch } from './browser.mjs'

const args = process.argv.slice(2)
const out = path.resolve(args.shift())
let w = 260
let top = 1
let from = 0
const files = []
while (args.length) {
  const a = args.shift()
  if (a === '--w') w = Number(args.shift())
  else if (a === '--top') top = Number(args.shift())
  else if (a === '--from') from = Number(args.shift())
  else files.push(path.resolve(a))
}
const h = Math.round(w * (844 / 390) * top)
const cols = Math.min(files.length, Math.max(1, Math.floor(1560 / (w + 8))))
const html = `<body style="margin:0;background:#888;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:${cols * (w + 8) + 8}px">${files
  .map((f) => `<div style="width:${w}px;height:${h}px;overflow:hidden;position:relative"><img src="file://${f}" style="width:${w}px;display:block;margin-top:-${Math.round(w * (844 / 390) * from)}px"><span style="position:absolute;left:2px;top:2px;background:#fff;font:11px sans-serif">${path.basename(f)}</span></div>`)
  .join('')}</body>`
const tmp = path.join(os.tmpdir(), `contact-${process.pid}.html`)
fs.writeFileSync(tmp, html)
const browser = await launch()
try {
  const page = await browser.newPage()
  await page.setViewport({ width: cols * (w + 8) + 8, height: 200 })
  await page.goto(`file://${tmp}`, { waitUntil: 'load' })
  await page.screenshot({ path: out, fullPage: true })
} finally {
  await browser.close()
  fs.unlinkSync(tmp)
}
