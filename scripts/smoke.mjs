// 通しテスト: タップ → タイトル → 1回分あそぶ（途中で1回わざと間違える）→ 結果
// 使い方: npm run smoke   （スクショは .smoke/ に出力）
import { createServer } from 'vite'
import fs from 'fs'
import { launch } from './browser.mjs'

const OUT = '.smoke'
fs.mkdirSync(OUT, { recursive: true })
const data = JSON.parse(fs.readFileSync('src/data/questions.json', 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' })
await server.listen()
const browser = await launch()
const errors = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await sleep(800)
  await page.screenshot({ path: `${OUT}/1-title.png` })
  await page.click('.level-btn')
  await sleep(1200)
  await page.screenshot({ path: `${OUT}/2-quiz.png` })
  let answered = 0
  for (let i = 0; i < 14 && (await page.$('.picture')); i++) {
    const key = await page.$eval('.picture', (el) => el.querySelector('img')?.getAttribute('src') ?? el.textContent)
    const q = data.questions.find((q) => q.img === key || q.e === key)
    if (!q) throw new Error(`絵から問題が特定できません: ${key}`)
    const wrong = i === 6
    for (const b of await page.$$('.choice')) {
      if (((await b.evaluate((el) => el.textContent)) === q.a) !== wrong) {
        await b.click()
        break
      }
    }
    answered++
    await sleep(400)
    if (i === 4) await page.screenshot({ path: `${OUT}/3-fever.png` })
    await page.waitForFunction(() => !document.querySelector('.choice.is-answer'), { timeout: 20000 })
    await sleep(300)
  }
  await sleep(3500)
  await page.screenshot({ path: `${OUT}/4-result.png` })
  if (!(await page.$('.result'))) errors.push('結果画面に到達しませんでした')
  console.log(`${answered}問回答`)
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) {
  console.error('❌ エラー:', errors)
  process.exit(1)
}
console.log(`✅ スモークテストOK（スクショ: ${OUT}/）`)
