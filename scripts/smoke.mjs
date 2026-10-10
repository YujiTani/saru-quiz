// 通しテスト（スクショは .smoke/ に出力）。使い方: npm run smoke
//  1. 時間切れ: タップ → タイトル → 8問（途中で1回わざと間違える）→ ゲージ切れ →「しゅうりょうー！」→ 結果 → ポップアップ
//  2. クリア: ?goal=3 で3問正解 →「くりあー！」→ クリアタイムつきの結果
//  3. 解放: かんたんクリアで ふつうが あそべる / せってい: なまえ（ひらがな以外は はじく）・こえ・おと・おんりょう・うごきの つよさ
//  4. 演出: ?show=ugoku:norimono で正解、?show=zukkoke:hakushon でまちがい（9-*.png）
//  5. みちのり（E=0 / 0.5 / 0.9）・おさるバンド・リーチ（?goal=3 で 画面のふちのおさる → ぷはーっ！）（10-*.png）
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
  // ?goal=3 は はじめから のこり3問 → リーチ（バナー「あと3もん！」と、画面のふちで息をとめるおさる）
  if (!(await page.$('.road'))) errors.push('みちのりが出ていません')
  if (!(await page.$('.reach-crowd'))) errors.push('?goal=3 なのに リーチのおさる（.reach-crowd）が出ていません')
  if (!(await page.$('.banner.reach'))) errors.push('?goal=3 なのに「あと3もん！」のバナーが出ていません')
  if ((await page.$$('.reach-crowd .reach-mk')).length !== 3) errors.push('のこり3問なのに おさるが3匹ではありません')
  await page.screenshot({ path: `${OUT}/5-reach.png` })
  for (let i = 0; i < 3; i++) {
    if (i === 2 && !(await page.$('.picture-wrap.big'))) errors.push('ラスト（のこり1問）で絵が大きくなっていません')
    await answer(page, i)
    await sleep(400)
    if (i === 2) {
      if (!(await page.$('.reach-puha'))) errors.push('クリアの正解で「ぷはーっ！」が出ていません')
      await page.screenshot({ path: `${OUT}/5-puha.png` })
    }
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
  // うごきの つよさ（0〜100・10刻み）
  await page.$eval('.motion-row input', (el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, '30')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(200)
  await page.screenshot({ path: `${OUT}/7-settings.png` })
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/settings')))
  const players = await page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/players')))
  if (players.list[0]?.name !== 'ゆうちゃん' || saved.voice !== 'tsumugi' || saved.muted !== true || saved.motion !== 0.3) errors.push(`設定が保存されていません: ${JSON.stringify({ saved, players: players.list.map((p) => p.name) })}`)
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

  // 5. 演出（?show で必ず使う。isTestRun なので記録はされない）
  // うごくえ: のりもの。正解の300ms後（ためている）と、走り去るとき
  await start(page, '?show=ugoku:norimono&cat=のりもの&goal=3&time=60')
  await page.click('.level-btn')
  await sleep(1200)
  await answer(page, 0)
  await sleep(300)
  await page.screenshot({ path: `${OUT}/9-ugoku.png` })
  await sleep(700)
  if ((await page.$$('#show-layer .show-clone')).length !== 1) errors.push('うごくえの絵の複製が出ていません')
  if ((await page.$eval('.picture img', (el) => getComputedStyle(el).opacity)) !== '0') errors.push('うごくえの間、元の絵が透明になっていません')
  await page.screenshot({ path: `${OUT}/9-ugoku-run.png` })
  await page.waitForFunction(() => !document.querySelector('.choice.is-answer'), { timeout: 20000 })
  await sleep(300)
  if ((await page.$eval('.picture img', (el) => getComputedStyle(el).opacity)) !== '1') errors.push('次の問題で絵が元にもどっていません')
  if ((await page.$$('#show-layer > *')).length !== 0) errors.push('次の問題になっても演出の要素が残っています')
  console.log('5a. うごくえ: OK')

  // ずっこけ: まちがえた直後（くしゃみで帽子がとぶ）と、そのあとの「ばあ！」
  await start(page, '?show=zukkoke:hakushon&cat=のりもの&time=60')
  await page.click('.level-btn')
  await sleep(1200)
  await answer(page, 0, true)
  await sleep(1100)
  await page.screenshot({ path: `${OUT}/9-zukkoke.png` })
  await page.waitForSelector('.show-clone', { timeout: 20000 })
  await sleep(700)
  await page.screenshot({ path: `${OUT}/9-peekaboo.png` })
  console.log('5b. ずっこけ: OK')

  // 6. みちのり（E=0 / 0.5 / 0.9）と おさるバンド（?start= で せいかい数を決めて始める。記録はされない）
  const E_SHOTS = [[0, 'e0'], [10, 'e50'], [18, 'e90']]
  for (const [n, name] of E_SHOTS) {
    await start(page, `?goal=20&start=${n}&cat=どうぶつ&time=60`)
    await page.click('.level-btn')
    await sleep(1500)
    await page.screenshot({ path: `${OUT}/10-michi-${name}.png` })
    const sky = await page.$eval('.road', (el) => el.className)
    const want = { e0: 'sky-morning', e50: 'sky-day', e90: 'sky-night' }[name]
    if (!sky.includes(want)) errors.push(`みちのりの空が ${want} ではありません（${sky}）`)
    const bands = (await page.$$('.band-mk')).length
    const wantBands = { e0: 1, e50: 3, e90: 5 }[name]
    if (bands !== wantBands) errors.push(`E=${name} の おさるバンドが ${wantBands}匹ではなく ${bands}匹です`)
    const crowd = (await page.$$('.reach-crowd .reach-mk')).length
    const wantCrowd = name === 'e90' ? 4 : 0 // のこり2問は4匹、それより前は出さない
    if (crowd !== wantCrowd) errors.push(`のこり${20 - n}問の リーチのおさるが ${wantCrowd}匹ではなく ${crowd}匹です`)
    const flies = (await page.$$('.road-firefly')).length
    if ((name === 'e90') !== (flies > 0)) errors.push(`ホタルの出かたがおかしい（${name}: ${flies}）`)
  }
  console.log('6a. みちのり・おさるバンド: OK')

  // 動きの強さ 0: ホタル・流れ星は出さず、おさるは跳ねず、リーチのおさるはぷるぷるしない
  await page.evaluate(() => localStorage.setItem('saru-quiz/settings', JSON.stringify({ motion: 0 })))
  await start(page, '?goal=20&start=18&cat=どうぶつ&time=60')
  await page.click('.level-btn')
  await sleep(1500)
  if (await page.$('.road-firefly, .road-meteor')) errors.push('動きの強さ 0 なのに ホタル・流れ星が出ています')
  if (!(await page.$('.road.still'))) errors.push('動きの強さ 0 の みちのりに still が付いていません')
  if (!(await page.$('.reach-crowd.still'))) errors.push('動きの強さ 0 の リーチのおさるに still が付いていません')
  await page.screenshot({ path: `${OUT}/10-motion0.png` })
  await page.evaluate(() => localStorage.setItem('saru-quiz/settings', JSON.stringify({ motion: 1 })))
  console.log('6b. 動きの強さ0: OK')
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) {
  console.error('❌ エラー:', errors)
  process.exit(1)
}
console.log(`✅ スモークテストOK（スクショ: ${OUT}/）`)
