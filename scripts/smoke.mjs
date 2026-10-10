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

/** 今の問題に答える（wrong=true でわざと間違える）。選んでから「これ！」。同じボタンの2回タップでは回答にならないことも確かめる */
async function answer(page, i, wrong = false) {
  const key = await page.$eval('.picture', (el) => el.querySelector('img')?.getAttribute('src') ?? el.textContent)
  const q = data.questions.find((q) => q.img === key || q.e === key)
  if (!q) throw new Error(`絵から問題が特定できません: ${key}`)
  for (const b of await page.$$('.choice')) {
    if (((await b.evaluate((el) => el.textContent)) === q.a) !== wrong) {
      await b.click()
      await sleep(200)
      if (i === 1) await page.screenshot({ path: `${OUT}/2b-selected.png` })
      if (i === 1) {
        await b.click()
        await sleep(300)
        if (await page.$('.choice.is-answer')) errors.push('同じ選択肢の2回タップで回答になっています')
      }
      await page.click('.decide.show')
      return
    }
  }
  throw new Error('選択肢が見つかりません')
}

/** なまえ入力欄に（iPhone の変換を通さず）値を入れる */
async function typeName(page, v) {
  await page.$eval('.name-input', (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
}

async function start(page, query) {
  await page.goto(`http://localhost:5199/${query}`, { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await sleep(800)
  // はじめてなら キャラをつくる
  if (await page.$('.player-edit')) {
    await typeName(page, 'てすと')
    await page.click('.char-btn:nth-child(5)')
    await page.click('.name-save')
    await sleep(600)
  }
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
  // ランキング（Supabase）は本番に書きこまないよう差し替え、送った中身を記録する
  const submitted = []
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
  await page.setRequestInterception(true)
  page.on('request', (r) => {
    if (!r.url().includes('/rest/v1/')) return r.continue()
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: CORS })
    if (r.url().includes('/rpc/submit_score')) {
      submitted.push(JSON.parse(r.postData()))
      return r.respond({ status: 200, contentType: 'application/json', headers: CORS, body: '{"day":1,"month":1,"newBest":true}' })
    }
    r.respond({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' })
  })

  // 0. はじめての起動 → キャラづくり
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await page.waitForSelector('.player-edit', { timeout: 5000 })
  await page.screenshot({ path: `${OUT}/0-create.png` })
  if (await page.$('.home-btn')) errors.push('はじめてのキャラづくりで タイトルにもどるボタンが出ています')

  // 1. 時間切れで終わる
  await start(page, '?time=15')
  if (!(await page.$('.player-plate.big'))) errors.push('タイトルに キャラのなまえが出ていません')
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
  await page.waitForSelector('.countdown', { timeout: 60000 })
  await sleep(300)
  await page.screenshot({ path: `${OUT}/3a-countdown.png` })
  await page.waitForSelector('.banner.end', { timeout: 60000 })
  await page.screenshot({ path: `${OUT}/3b-end.png` })
  await page.waitForSelector('.again-pop', { timeout: 40000 })
  await page.screenshot({ path: `${OUT}/4-result.png` })
  if (await page.$('.result-cleartime')) errors.push('時間切れなのにクリアタイムが出ています')
  console.log(`1. 時間切れ: ${answered}問回答`)

  // 2. 3問クリアで終わる（ランキングに送る中身も確かめる）
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
  await sleep(500)
  const sent = submitted.find((b) => b.p_cleared)
  if (!sent) errors.push('クリアしたのにランキングに送っていません')
  else if (!Number.isInteger(sent.p_clear_ms) || sent.p_course !== 1) errors.push(`ランキングに送る値がおかしい: ${JSON.stringify(sent)}`)
  console.log('2. クリア: OK')

  // 3. かんたんクリアで ふつうが解放 → せってい
  await start(page, '')
  if (await page.$('.level-btn.is-locked')) errors.push('かんたんをクリアしても ふつう が解放されません')
  if ((await page.$$('.level-btn')).length !== 2) errors.push('むずかしい が早く出ています')
  await page.screenshot({ path: `${OUT}/6b-unlocked.png` })
  await page.click('.gear-btn')
  await sleep(400)
  await page.click('.edit-player-btn')
  await sleep(400)
  await typeName(page, 'Yuu1')
  await page.click('.name-save')
  await sleep(200)
  if (!(await page.$('.name-msg.ng'))) errors.push('ひらがな以外の名前がはじかれていません')
  await typeName(page, 'ゆうちゃん')
  await page.click('.color-btn:nth-child(5)')
  await page.click('.name-save')
  await sleep(600)
  if (!(await page.$('.settings-player'))) errors.push('キャラを なおしたあと せっていに もどっていません')
  await page.click('.voice-btn:nth-child(3)')
  await page.click('.sound-btn:nth-child(2)')
  await sleep(200)
  await page.screenshot({ path: `${OUT}/7-settings.png` })
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/settings')))
  const players = await page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/players')))
  if (players.list[0]?.name !== 'ゆうちゃん' || saved.voice !== 'tsumugi' || saved.muted !== true) errors.push(`設定が保存されていません: ${JSON.stringify({ saved, players: players.list.map((p) => p.name) })}`)
  console.log('3. せってい: OK')

  // 3b. キャラをふやして切りかえる（コースの解放はキャラごと）
  await page.click('.home-btn')
  await sleep(300)
  await page.click('.player-chip.add')
  await sleep(400)
  await typeName(page, 'はなちゃん')
  await page.click('.char-btn:nth-child(9)')
  await page.click('.name-save')
  await sleep(600)
  if ((await page.$eval('.player-plate.big', (e) => e.textContent)) !== 'はなちゃん') errors.push('あたらしいキャラに切りかわっていません')
  if (!(await page.$('.level-btn.is-locked'))) errors.push('あたらしいキャラなのに ふつう が解放されています')
  await page.screenshot({ path: `${OUT}/7b-player2.png` })
  await page.click('.player-chip:not(.add)')
  await sleep(400)
  if ((await page.$eval('.player-plate.big', (e) => e.textContent)) !== 'ゆうちゃん') errors.push('キャラの切りかえができません')
  if (await page.$('.level-btn.is-locked')) errors.push('もとのキャラの ふつう解放が消えています')
  // けすときは3回たしかめる（とちゅうで やめられる）
  await page.click('.gear-btn')
  await sleep(300)
  await page.click('.edit-player-btn')
  await sleep(300)
  for (let i = 1; i <= 3; i++) {
    await page.click('.delete-btn')
    await sleep(250)
    if (!(await page.$(`.delete-warn.step${i}`))) errors.push(`けすときの ${i}かいめの けいこくが 出ていません`)
  }
  await page.screenshot({ path: `${OUT}/7c-delete-warn.png` })
  await page.click('.keep-btn')
  await sleep(250)
  if (await page.$('.delete-warn')) errors.push('「やっぱり けさない」で もとに もどりません')
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/players')).list.length)
  if (n !== 2) errors.push(`キャラが けされてしまいました（${n}人）`)
  await page.click('.home-btn')
  await sleep(300)
  console.log('3b. キャラ切りかえ・けす確認: OK')

  // 4. ランキング画面（接続先が未設定なら「じゅんびちゅう」、設定済みなら一覧かメッセージ）
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
