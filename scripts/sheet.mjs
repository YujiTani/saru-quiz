// イラストの一覧画像をつくる（目視レビュー用）。SVGの構文チェックも行う
// 使い方: node scripts/sheet.mjs くだもの   / node scripts/sheet.mjs --ids red-apple,dog / node scripts/sheet.mjs --all
import fs from 'fs'
import { execFileSync } from 'child_process'
import { launch } from './browser.mjs'

const data = JSON.parse(fs.readFileSync('src/data/questions.json', 'utf8'))
const arg = process.argv[2]
let list = data.questions.filter((q) => fs.existsSync(`public/illust/${q.id}.svg`))
if (arg === '--ids') {
  const ids = new Set(process.argv[3].split(','))
  list = list.filter((q) => ids.has(q.id))
} else if (arg && arg !== '--all') list = list.filter((q) => q.c === arg)

let bad = 0
for (const q of list) {
  const file = `public/illust/${q.id}.svg`
  try {
    execFileSync('xmllint', ['--noout', file], { stdio: 'pipe' })
    if (!fs.readFileSync(file, 'utf8').includes('viewBox="0 0 256 256"')) throw new Error('viewBox が 0 0 256 256 ではありません')
  } catch (e) {
    bad++
    console.error(`❌ ${file}: ${String(e.stderr ?? e.message).trim()}`)
  }
}

const cells = list.map((q) => `<figure><img src="data:image/svg+xml;base64,${fs.readFileSync(`public/illust/${q.id}.svg`).toString('base64')}"><figcaption>${q.a}<small>${q.id}</small></figcaption></figure>`).join('')
const html = `<html><body style="margin:0;background:#fff;font-family:sans-serif"><div style="display:grid;grid-template-columns:repeat(6,170px);gap:6px;padding:8px">${cells}</div>
<style>figure{margin:0;border:1px solid #ddd;border-radius:8px;text-align:center}img{width:150px;height:150px}figcaption{font-size:18px;font-weight:bold}small{display:block;font-size:10px;color:#888;font-weight:normal}</style></body></html>`
const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 6 * 176 + 16, height: 300 })
await page.setContent(html)
fs.mkdirSync('.sheets', { recursive: true })
const out = `.sheets/${(arg && !arg.startsWith('--') ? arg : 'sheet').replace(/[\/・]/g, '_')}.png`
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(`${list.length}枚 → ${out}${bad ? `（構文エラー ${bad}件）` : ''}`)
if (bad) process.exit(1)
