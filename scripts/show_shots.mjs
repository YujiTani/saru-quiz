// 演出を1つずつ再生してスクショを撮る（目で確かめる用）。使い方: node scripts/show_shots.mjs [演出id…]（なければ全部）
// うごくえは正解、ずっこけは まちがいで再生する。出力: .smoke/shows/<id>-<ミリ秒>.png
// 動きの強さを変えて見るとき: MOTION=0 node scripts/show_shots.mjs …（出力は .smoke/shows-m0/）
import { createServer } from 'vite'
import fs from 'fs'
import { launch } from './browser.mjs'

const MOTION = process.env.MOTION
const OUT = `.smoke/shows${MOTION === undefined ? '' : `-m${MOTION}`}`
fs.mkdirSync(OUT, { recursive: true })
const data = JSON.parse(fs.readFileSync('src/data/questions.json', 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 5198

const server = await createServer({ server: { port: PORT }, logLevel: 'error' })
await server.listen()
const { SHOWS } = await server.ssrLoadModule('/src/shows/registry.ts')
const want = process.argv.slice(2)
const shows = SHOWS.filter((s) => (s.cat === 'ugoku' || s.cat === 'zukkoke') && (!want.length || want.includes(s.id)))
const browser = await launch()
const errors = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
  if (MOTION !== undefined) await page.evaluateOnNewDocument((m) => localStorage.setItem('saru-quiz/settings', JSON.stringify({ motion: Number(m) })), MOTION)
  for (const s of shows) {
    const wrong = s.cat === 'zukkoke'
    const cat = s.forCat ?? 'どうぶつ'
    await page.goto(`http://localhost:${PORT}/?show=${encodeURIComponent(s.id)}&cat=${encodeURIComponent(cat)}&seed=1&time=60`, { waitUntil: 'networkidle0' })
    await page.click('.tap-start')
    await sleep(800)
    if (await page.$('.player-edit')) {
      await page.$eval('.name-input', (el) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'てすと')
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await page.click('.char-btn:nth-child(5)')
      await page.click('.name-save')
      await sleep(600)
    }
    await page.click('.level-btn')
    await sleep(1200)
    const key = await page.$eval('.picture', (el) => el.querySelector('img')?.getAttribute('src') ?? el.textContent)
    const q = data.questions.find((q) => q.img === key || q.e === key)
    for (const b of await page.$$('.choice')) {
      if (((await b.evaluate((el) => el.textContent)) === q.a) !== wrong) {
        await b.click()
        await sleep(200)
        break
      }
    }
    await page.click('.decide.show')
    const t0 = Date.now()
    for (const at of wrong ? [500, 1000, 1600, 2600, 3400] : [300, 700, 1100, 1600, 2200]) {
      await sleep(Math.max(0, at - (Date.now() - t0)))
      await page.screenshot({ path: `${OUT}/${s.id.replace(':', '-')}-${at}.png` })
    }
    console.log(s.id, 'OK')
  }
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) console.error('エラー:', [...new Set(errors)])
