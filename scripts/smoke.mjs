// 通しテスト（スクショは .smoke/ に出力）。使い方: npm run smoke
//  1. 時間切れ: タップ → タイトル → 8問（途中で1回わざと間違える）→ ゲージ切れ →「しゅうりょうー！」→ 結果 → ポップアップ
//  2. クリア: ?goal=3 で3問正解 →「くりあー！」→ クリアタイムつきの結果
//  3. 解放: かんたんクリアで ふつうが あそべる / せってい: なまえ（ひらがな以外は はじく）・こえ・おと・おんりょう
import { createServer } from 'vite'
import fs from 'fs'
import { launch } from './browser.mjs'

const OUT = '.smoke'
fs.mkdirSync(OUT, { recursive: true })
const data = JSON.parse(fs.readFileSync('src/data/questions.json', 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 今の問題に答える（wrong=true でわざと間違える）。i が偶数なら「これ！」、奇数なら同じボタンをもう一度 */
async function answer(page, i, wrong = false) {
  const key = await page.$eval('.picture', (el) => el.querySelector('img')?.getAttribute('src') ?? el.textContent)
  const q = data.questions.find((q) => q.img === key || q.e === key)
  if (!q) throw new Error(`絵から問題が特定できません: ${key}`)
  for (const b of await page.$$('.choice')) {
    if (((await b.evaluate((el) => el.textContent)) === q.a) !== wrong) {
      await b.click()
      await sleep(200)
      if (i === 1) await page.screenshot({ path: `${OUT}/2b-selected.png` })
      if (i % 2 === 0) await page.click('.decide.show')
      else await b.click()
      return
    }
  }
  throw new Error('選択肢が見つかりません')
}

async function start(page, query) {
  await page.goto(`http://localhost:5199/${query}`, { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await sleep(800)
}

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' })
await server.listen()
const browser = await launch()
const errors = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // 1. 時間切れで終わる
  await start(page, '?time=15')
  await page.screenshot({ path: `${OUT}/1-title.png` })
  if (!(await page.$('.level-btn.is-locked'))) errors.push('さいしょから ふつう が解放されています')
  await page.click('.level-btn')
  await sleep(1200)
  await page.screenshot({ path: `${OUT}/2-quiz.png` })
  let answered = 0
  for (let i = 0; i < 8 && (await page.$('.picture')) && !(await page.$('.banner.end')); i++) {
    await answer(page, i, i === 6)
    answered++
    await sleep(400)
    if (i === 4) await page.screenshot({ path: `${OUT}/3-fever.png` })
    await page.waitForFunction(() => !document.querySelector('.choice.is-answer'), { timeout: 20000 })
    await sleep(300)
  }
  await page.waitForSelector('.banner.end', { timeout: 60000 })
  await page.screenshot({ path: `${OUT}/3b-end.png` })
  await page.waitForSelector('.again-pop', { timeout: 40000 })
  await page.screenshot({ path: `${OUT}/4-result.png` })
  if (await page.$('.result-cleartime')) errors.push('時間切れなのにクリアタイムが出ています')
  console.log(`1. 時間切れ: ${answered}問回答`)

  // 2. 3問クリアで終わる
  await start(page, '?goal=3&time=60')
  await page.click('.level-btn')
  await sleep(1200)
  for (let i = 0; i < 3; i++) {
    await answer(page, i)
    await sleep(400)
    if (i < 2) await page.waitForFunction(() => !document.querySelector('.choice.is-answer'), { timeout: 20000 })
  }
  await page.waitForSelector('.banner.clear', { timeout: 20000 })
  await page.screenshot({ path: `${OUT}/5-clear.png` })
  await page.waitForSelector('.result-cleartime', { timeout: 20000 })
  await sleep(600)
  await page.screenshot({ path: `${OUT}/6-cleartime.png` })
  console.log('2. クリア: OK')

  // 3. かんたんクリアで ふつうが解放 → せってい
  await start(page, '')
  if (await page.$('.level-btn.is-locked')) errors.push('かんたんをクリアしても ふつう が解放されません')
  if ((await page.$$('.level-btn')).length !== 2) errors.push('むずかしい が早く出ています')
  await page.screenshot({ path: `${OUT}/6b-unlocked.png` })
  await page.click('.gear-btn')
  await sleep(400)
  await page.type('.name-input', 'Yuu1')
  await page.click('.name-save')
  await sleep(200)
  if (!(await page.$('.name-msg.ng'))) errors.push('ひらがな以外の名前がはじかれていません')
  await page.$eval('.name-input', (el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, 'ゆうちゃん')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('.name-save')
  await sleep(200)
  if (!(await page.$('.name-msg.ok'))) errors.push('ひらがなの名前が保存できません')
  await page.click('.voice-btn:nth-child(3)')
  await page.click('.sound-btn:nth-child(2)')
  await sleep(200)
  await page.screenshot({ path: `${OUT}/7-settings.png` })
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/settings')))
  if (saved.playerName !== 'ゆうちゃん' || saved.voice !== 'tsumugi' || saved.muted !== true) errors.push(`設定が保存されていません: ${JSON.stringify(saved)}`)
  console.log('3. せってい: OK')

  // 4. ランキング画面（接続先が未設定なら「じゅんびちゅう」、設定済みなら一覧かメッセージ）
  await page.click('.back-btn')
  await sleep(300)
  await page.click('.title-btns .gear-btn:nth-child(2)')
  await page.waitForSelector('.rank-list', { timeout: 5000 })
  await page.click('.rank-tabs:nth-of-type(2) .rank-tab:nth-child(2)')
  await sleep(800)
  await page.screenshot({ path: `${OUT}/8-ranking.png` })
  console.log('4. らんきんぐ: OK')
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) {
  console.error('❌ エラー:', errors)
  process.exit(1)
}
console.log(`✅ スモークテストOK（スクショ: ${OUT}/）`)
