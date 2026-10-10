// 演出を1つずつ再生してスクショを撮る（目で確かめる用）。使い方: node scripts/show_shots.mjs [演出id…]（なければ全部）
// うごくえは正解、ずっこけは まちがいで再生する。ほかに特別な場面も撮れる（peekaboo / michi-… / reach-… / band-…）。出力: .smoke/shows/<id>-<ミリ秒>.png
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
// 撮る場面。answer: 'ok' 正解 / 'ng' まちがい / null 答えない。times は答えた（または開いた）あとのミリ秒
const FRAMES = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)
// 長めの演出は撮る時刻を変える
const LONG = {
  'ugoku:machi': [300, 800, 1300, 1800, 2300],
  'ugoku:karada': [400, 900, 1500, 2100, 2700],
  'ugoku:hito': [400, 900, 1400, 1900, 2400],
  'ugoku:fuku': [300, 800, 1300, 1900, 2400],
  'zukkoke:hanabanana': [400, 800, 1200, 1600, 2100],
  'zukkoke:gunya': [400, 800, 1200, 1600, 2100],
  'zukkoke:puri': [400, 800, 1200, 1700, 2200],
  'zukkoke:neko': [400, 900, 1500, 2100, 2700, 3300],
}
const targets = SHOWS.filter((s) => s.cat === 'ugoku' || s.cat === 'zukkoke').map((s) => ({
  id: s.id,
  query: `show=${encodeURIComponent(s.id)}&cat=${encodeURIComponent(s.forCat ?? 'どうぶつ')}`,
  answer: s.cat === 'zukkoke' ? 'ng' : 'ok',
  times: LONG[s.id] ?? (s.cat === 'zukkoke' ? [500, 1000, 1600, 2600, 3400] : [300, 700, 1100, 1600, 2200]),
}))
// 単語や月で変わるうごくえ: てんき（あめ・ゆき・にじ・たいよう・かみなり・かぜ・きらきら）、がっき（5種）、きせつ（4つの季節）
const VARIANTS = [
  ['tenki', 'rain', 'ugoku:tenki', 'rain'], ['tenki', 'snow', 'ugoku:tenki', 'snow'], ['tenki', 'rainbow', 'ugoku:tenki', 'rainbow'], ['tenki', 'sun', 'ugoku:tenki', 'sun'],
  ['tenki', 'thunder', 'ugoku:tenki', 'lightning'], ['tenki', 'wind', 'ugoku:tenki', 'wind'], ['tenki', 'sparkle', 'ugoku:tenki', 'cloud'],
  ['gakki', 'drum', 'ugoku:gakki', 'drum'], ['gakki', 'piano', 'ugoku:gakki', 'piano'], ['gakki', 'trumpet', 'ugoku:gakki', 'trumpet'], ['gakki', 'bell', 'ugoku:gakki', 'jingle-bell'], ['gakki', 'marimba', 'ugoku:gakki', 'guitar'],
]
for (const [name, v, show, word] of VARIANTS) {
  targets.push({ id: `${name}-${v}`, query: `show=${encodeURIComponent(show)}&word=${word}`, answer: 'ok', times: [300, 700, 1100, 1600, 2200] })
}
for (const [v, month] of [['spring', 4], ['summer', 7], ['autumn', 10], ['winter', 1]]) {
  targets.push({ id: `kisetsu-${v}`, query: `show=ugoku:kisetsu&cat=${encodeURIComponent('きせつ・ぎょうじ')}&month=${month}`, answer: 'ok', times: [400, 900, 1400, 1900] })
}
// いないいない…ばあ！ を細かく（まちがえたあと）
targets.push({ id: 'peekaboo', query: 'show=zukkoke:slip&cat=どうぶつ', answer: 'ng', times: FRAMES(1500, 4500, 300) })
// みちのり: 4種類 × E=0 / 0.5 / 0.9（goal=20 に start=0 / 10 / 18）
for (const t of ['jungle', 'umi', 'okashi', 'uchu']) {
  for (const n of [0, 10, 18]) targets.push({ id: `michi-${t}-e${n * 5}`, query: `show=michi:${t}&cat=どうぶつ&goal=20&start=${n}`, answer: null, times: [1500] })
}
// 橋（1/3）とどうくつ（2/3）を通るとき
targets.push({ id: 'michi-bridge', query: 'show=michi:jungle&cat=どうぶつ&goal=6&start=1', answer: 'ok', times: [300, 800, 1400] })
targets.push({ id: 'michi-cave', query: 'show=michi:jungle&cat=どうぶつ&goal=6&start=3', answer: 'ok', times: FRAMES(500, 2600, 350) })
// リーチ: ?goal=3（のこり3問から）/ のこり1問（ラスト！）/ クリアの正解（ぷはーっ！）
targets.push({ id: 'reach-start', query: 'cat=どうぶつ&goal=3', answer: null, times: [600, 1200, 2500] })
targets.push({ id: 'reach-last', query: 'cat=どうぶつ&goal=3&start=2', answer: null, times: [1500] })
targets.push({ id: 'reach-clear', query: 'cat=どうぶつ&goal=3&start=2', answer: 'ok', times: [200, 600, 1000, 1500] })
// おさるバンド: 楽器が4つ（E=0.8）→ 正解で5つめが加わる
targets.push({ id: 'band-4', query: 'cat=どうぶつ&goal=10&start=7', answer: null, times: [1500] })
targets.push({ id: 'band-5', query: 'cat=どうぶつ&goal=10&start=7', answer: 'ok', times: [200, 600, 1200] })
targets.push({ id: 'band-combo', query: 'cat=どうぶつ&goal=10&start=3', answer: 'ok', repeat: 3, times: [300, 900] }) // れんぞく3のとき、バンドは左に寄る
targets.push({ id: 'band-fever', query: 'cat=どうぶつ&goal=40&start=3', answer: null, times: [1500] })
const want = process.argv.slice(2)
const shows = targets.filter((t) => !want.length || want.some((w) => t.id === w || t.id.startsWith(`${w}-`)))
const browser = await launch()
const errors = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
  // ?month=N のときは、今を その月の15日にする（きせつのうごくえの確認用）
  await page.evaluateOnNewDocument(() => {
    const m = Number(new URLSearchParams(location.search).get('month'))
    if (m) {
      const fixed = new Date(2026, m - 1, 15, 12).getTime()
      Date.now = () => fixed
    }
  })
  if (MOTION !== undefined) await page.evaluateOnNewDocument((m) => localStorage.setItem('saru-quiz/settings', JSON.stringify({ motion: Number(m) })), MOTION)
  for (const s of shows) {
    await page.goto(`http://localhost:${PORT}/?${s.query}&seed=1&time=60`, { waitUntil: 'networkidle0' })
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
    const t0 = Date.now()
    if (s.answer) {
      await sleep(1200)
      for (let r = 0; r < (s.repeat ?? 1); r++) {
        const key = await page.$eval('.picture', (el) => el.querySelector('img')?.getAttribute('src') ?? el.textContent)
        const q = data.questions.find((q) => q.img === key || q.e === key)
        for (const b of await page.$$('.choice')) {
          if (((await b.evaluate((el) => el.textContent)) === q.a) !== (s.answer === 'ng')) {
            await b.click()
            await sleep(200)
            break
          }
        }
        await page.click('.decide.show')
        // 続けて答えるときは、次の問題になるまで待つ
        if (r < (s.repeat ?? 1) - 1) {
          await page.waitForFunction(() => !document.querySelector('.choice.is-answer'), { timeout: 20000 })
          await sleep(1500)
        }
      }
    }
    const t1 = Date.now()
    for (const at of s.times) {
      await sleep(Math.max(0, at - (Date.now() - (s.answer ? t1 : t0))))
      await page.screenshot({ path: `${OUT}/${s.id.replace(':', '-')}-${at}.png` })
    }
    console.log(s.id, 'OK')
  }
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) console.error('エラー:', [...new Set(errors)])
