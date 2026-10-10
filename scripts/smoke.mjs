// 通しテスト（スクショは .smoke/ に出力）。使い方: npm run smoke
//  1. 時間切れ: タップ → タイトル → 8問（途中で1回わざと間違える）→ ゲージ切れ →「しゅうりょうー！」→ 結果 → ポップアップ
//  2. クリア: ?goal=3 で3問正解 →「くりあー！」→ クリアタイムつきの結果
//  3. 解放: かんたんクリアで ふつうが あそべる / せってい: なまえ（ひらがな以外は はじく）・こえ・おと・おんりょう・うごきの つよさ
//  4. 演出: ?show=ugoku:norimono で正解、?show=zukkoke:hakushon でまちがい（9-*.png）
//  5. みちのり（E=0 / 0.5 / 0.9）・おさるバンド・リーチ（?goal=3 で 画面のふちのおさる → ぷはーっ！）（10-*.png）
//  6. まなび: 手がかり（まちがえた単語が もう一度出たら 選択肢が減る → 3回目は正解が光る）→ おぼえたよ → ふくしゅう（時間ゲージなし・
//     ぜんぶ正解で review が空に）→ 2回目のプレイで「まえより のびたよ」→ くもりの絵（拭きとって ぴかぴか）（11-*.png）
//  7. 毎日の楽しみ: 1回目のあとにシールのカード（12-sticker）→ ?goal=3 のクリアで きねんしゃしん（12-finale-*）→ えにっき（月・日のページ。13-diary-*）
//     → 7枚そろう＋バナナのやま（トラック）のカード（14-*）
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

/** 今の問題（絵から特定する） */
async function currentQ(page) {
  const key = await page.$eval('.picture', (el) => el.querySelector('img')?.getAttribute('src') ?? el.textContent)
  const q = data.questions.find((q) => q.img === key || q.e === key)
  if (!q) throw new Error(`絵から問題が特定できません: ${key}`)
  return q
}

/** ラベルの選択肢を選んで「これ！」 */
async function choose(page, label) {
  for (const b of await page.$$('.choice')) {
    if ((await b.evaluate((el) => el.textContent)) === label) {
      await b.click()
      await sleep(200)
      await page.click('.decide.show')
      return
    }
  }
  throw new Error(`選択肢が見つかりません: ${label}`)
}

/** 今の問題が終わる（次の問題に進む・クリアする）まで待つ */
const settle = (page) => page.waitForFunction(() => !document.querySelector('.choice.is-answer') || document.querySelector('.banner.clear'), { timeout: 30000 })

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
const { BANANA_STAGES } = await server.ssrLoadModule('/src/lib/banana.ts')
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
  await sleep(2600)
  if (await page.$('.photo-scene')) errors.push('時間切れなのに きねんしゃしん（フィナーレ）が出ています')
  await page.waitForSelector('.again-pop', { timeout: 40000 })
  await page.screenshot({ path: `${OUT}/4-result.png` })
  if (await page.$('.result-cleartime')) errors.push('時間切れなのにクリアタイムが出ています')
  // その日はじめてのプレイ: シールのカード（シールが飛んできて貼られる）。7枚はそろっていない
  if (!(await page.$('.sticker-card'))) errors.push('1日のはじめてのプレイなのに「シールを もらったよ！」が出ていません')
  else {
    if (await page.$('.sticker-card.complete')) errors.push('1枚目なのに「ぜんぶ そろったよ」になっています')
    if ((await page.$$('.sticker-card .sticker-slot.got')).length !== 1) errors.push('1枚目なのに シールの台紙に1枚だけ貼られていません')
    await page.$eval('.sticker-card', (el) => el.scrollIntoView({ block: 'center' }))
    await sleep(1500)
    await page.screenshot({ path: `${OUT}/12-sticker.png` })
  }
  const saved1 = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
    return p.list.find((x) => x.id === p.current).save
  })
  const today1 = Object.values(saved1.diary)
  if (saved1.stickers !== 1 || today1.length !== 1 || today1[0].sticker !== 0) errors.push(`シールが保存されていません: stickers=${saved1.stickers} diary=${JSON.stringify(saved1.diary)}`)
  if (!Array.isArray(today1[0]?.mastered)) errors.push('diary に mastered がありません')
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
  // きねんしゃしん: 暗くなる → ひな壇に並ぶ → 3・2・1 → フラッシュ（1回だけ）→ 枠が貼られる。全体で4秒以内
  await page.waitForSelector('.photo-scene', { timeout: 20000 })
  const photoAt = Date.now()
  const phaseShot = { arranged: 100, count: 300, flash: 200, framed: 150 }
  for (const [ph, wait] of Object.entries(phaseShot)) {
    await page.waitForSelector(`.photo-scene[data-phase="${ph}"]`, { timeout: 8000 })
    await sleep(wait)
    if (ph === 'arranged') {
      const words = (await page.$$('.photo-scene .photo-word')).length
      if (words < 1 || words > 3) errors.push(`きねんしゃしんの ことばの絵が ${words}個です（3問正解）`)
      if (!(await page.$('.photo-scene .photo-monkey'))) errors.push('きねんしゃしんに おさるがいません')
      if ((await page.$$('.photo-scene .photo-flash')).length !== 1) errors.push('フラッシュの要素が1つではありません')
    }
    if (ph === 'count') {
      const n = await page.$eval('.photo-count', (el) => el.textContent)
      if (!['3', '2', '1'].includes(n)) errors.push(`カウントが 3・2・1 ではありません: ${n}`)
    }
    await page.screenshot({ path: `${OUT}/12-finale-${ph}.png` })
  }
  await page.waitForFunction(() => !document.querySelector('.photo-scene'), { timeout: 8000 })
  const photoMs = Date.now() - photoAt
  if (photoMs > 4300) errors.push(`きねんしゃしんが ${photoMs}ms かかっています（4秒以内）`)
  await page.waitForSelector('.result-cleartime', { timeout: 20000 })
  await sleep(600)
  await page.screenshot({ path: `${OUT}/6-cleartime.png` })
  await sleep(500)
  const sent = submitted.find((b) => b.p_cleared)
  if (!sent) errors.push('クリアしたのにランキングに送っていません')
  else if (!Number.isInteger(sent.p_clear_ms) || sent.p_course !== 1) errors.push(`ランキングに送る値がおかしい: ${JSON.stringify(sent)}`)
  // 前回（時間切れの1回目）よりせいかい数が少ないので「まえより のびたよ」は出ない
  await page.waitForSelector('.again-pop', { timeout: 90000 })
  if (await page.$('.grow-card')) errors.push('のびていないのに「まえより のびたよ」が出ています')
  if (await page.$('.sticker-card')) errors.push('同じ日の2回目なのに シールのカードが出ています')
  console.log(`2. クリア・きねんしゃしん（${photoMs}ms）: OK`)

  // 2b. えにっき: 月のページ（今日のマスにシール）→ 日のページ → 前の月・次の月
  const mySave0 = () =>
    page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
      return p.list.find((x) => x.id === p.current).save
    })
  await start(page, '')
  const diaryBtn = await page.$('.diary-btn')
  if (!diaryBtn) errors.push('タイトルに えにっきボタンがありません')
  else {
    if (!(await diaryBtn.evaluate((el) => el.textContent)).includes('シール 1')) errors.push('えにっきボタンに シールの枚数（1）が出ていません')
    await page.screenshot({ path: `${OUT}/13-title.png` })
    await diaryBtn.click()
    await sleep(500)
    if (!(await page.$('.diary-cell.today.played .sticker'))) errors.push('えにっきの今日のマスに シールがありません')
    if (!(await page.$('.diary-cell.today.played .cell-word'))) errors.push('えにっきの今日のマスに 小さい絵がありません')
    const blank = await page.$$eval('.diary-cell:not(.played):not(.blank)', (els) => els.filter((e) => e.children.length !== 1).length)
    if (blank) errors.push('遊んでいない日のマスに、日にち以外のものが描かれています')
    const wk = await page.$$eval('.diary-dow span', (els) => els.length)
    const cellsN = await page.$$eval('.diary-grid .diary-cell', (els) => els.length)
    if (wk !== 7 || cellsN % 7 !== 0) errors.push(`えにっきの月が 7列ではありません（曜日${wk}・マス${cellsN}）`)
    if (!(await page.$eval('.diary-nav.next', (el) => el.disabled))) errors.push('今の月なのに「つぎの月」が押せます')
    await page.screenshot({ path: `${OUT}/13-diary-month.png` })
    // 日をタップすると、その日の絵日記
    await page.click('.diary-cell.today.played')
    await sleep(500)
    const dateText = await page.$eval('.diary-date', (el) => el.textContent)
    const nowD = await page.evaluate(() => new Date().getDate())
    const nowM = await page.evaluate(() => new Date().getMonth() + 1)
    if (dateText !== `${nowM}がつ ${nowD}にち`) errors.push(`日のページの日付がちがう: ${dateText}`)
    const sv = await mySave0()
    const day0 = Object.values(sv.diary)[0]
    const nWords = (await page.$$('.diary-day .photo-card .photo-word')).length
    if (nWords < 1 || nWords !== Math.min(8, day0.words.length)) errors.push(`日のページの しゃしんの絵が ${nWords}個（words ${day0.words.length}）`)
    if (!(await page.$('.diary-day .photo-monkey'))) errors.push('日のページの しゃしんに おさるがいません')
    const plays = await page.$eval('.diary-stats b', (el) => el.textContent)
    if (plays !== String(day0.plays)) errors.push(`遊んだ回数がちがう: ${plays} / ${day0.plays}`)
    if (!(await page.$('.diary-stats .sticker'))) errors.push('日のページに シールがありません')
    const stars = (await page.$$('.diary-words .badge')).length
    if (stars !== day0.mastered.length) errors.push(`日のページの ☆ が ${stars}個（その日 ☆1になった単語は ${day0.mastered.length}個）`)
    await page.screenshot({ path: `${OUT}/13-diary-day.png` })
    await page.click('.diary-day .photo-word')
    await sleep(300)
    await page.click('.diary-back')
    await sleep(300)
    // 前の月へ → 次の月へ（今日より先には行けない）
    const label0 = await page.$eval('.diary-month', (el) => el.textContent)
    await page.click('.diary-nav.prev')
    await sleep(300)
    const label1 = await page.$eval('.diary-month', (el) => el.textContent)
    if (label1 === label0) errors.push('「まえの月」を押しても月が変わりません')
    if (await page.$('.diary-cell.played')) errors.push('遊んでいない前の月に 遊んだ日のマスがあります')
    await page.screenshot({ path: `${OUT}/13-diary-prev.png` })
    await page.click('.diary-nav.next')
    await sleep(300)
    if ((await page.$eval('.diary-month', (el) => el.textContent)) !== label0) errors.push('「つぎの月」で もとの月にもどれません')
    if (!(await page.$eval('.diary-nav.next', (el) => el.disabled))) errors.push('今の月で「つぎの月」が押せます')
  }
  console.log('2b. えにっき: OK')

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

  // 7. まなび: 手がかり → おぼえたよ → ふくしゅう → まえより のびたよ
  // ふつう（3択）を6問クリアまで。はじめの2問（W, X）をわざとまちがえる。W は2回目もまちがえて、3回目に正解が光る
  await start(page, '?goal=6&time=90')
  await page.click('.level-btn:nth-child(2)')
  await sleep(1200)
  const asked = {}
  const firstTwo = []
  let glowSeen = false
  for (let k = 0; k < 14 && !(await page.$('.banner.clear')); k++) {
    const q = await currentQ(page)
    const times = (asked[q.id] = (asked[q.id] ?? 0) + 1)
    const nChoices = (await page.$$('.choice')).length
    if (firstTwo.length < 2 && times === 1) firstTwo.push(q.id)
    const isW = q.id === firstTwo[0]
    const isX = q.id === firstTwo[1]
    let wrong = false
    if (times === 1) {
      if (nChoices !== 3) errors.push(`はじめて出た問題の選択肢が3つではなく${nChoices}つです`)
      wrong = isW || isX
    } else if (times === 2) {
      if (nChoices !== 2) errors.push(`まちがえた問題が2回目に出たのに 選択肢が減っていません（${nChoices}つ）`)
      if (await page.$('.choice.is-hint')) errors.push('2回目で正解が光っています')
      wrong = isW
    } else {
      await page.waitForSelector('.choice.is-hint', { timeout: 30000 }).catch(() => errors.push('3回目なのに 正解の選択肢が光りません'))
      const lit = await page.$$eval('.choice.is-hint', (els) => els.map((e) => e.textContent))
      if (lit.length !== 1 || lit[0] !== q.a) errors.push(`光っている選択肢が正解ではありません: ${JSON.stringify(lit)}`)
      if (!glowSeen) {
        await sleep(1000) // 2秒周期のいちばん光るところ
        await page.screenshot({ path: `${OUT}/11-hint-glow.png` })
      }
      glowSeen = true
    }
    if (times === 2 && k < 8) await page.screenshot({ path: `${OUT}/11-hint-fewer.png` })
    if (wrong) {
      for (const b of await page.$$('.choice')) {
        if ((await b.evaluate((el) => el.textContent)) !== q.a) {
          await b.click()
          await sleep(200)
          await page.click('.decide.show')
          break
        }
      }
    } else await choose(page, q.a)
    await sleep(300)
    await settle(page)
    await sleep(200)
  }
  if (!glowSeen) errors.push('手がかり（正解が光る）を確かめられませんでした')
  // 結果: ぜんぶ読み上げたあとに「おぼえたよ」のカード
  await page.waitForSelector('.learn-card', { timeout: 60000 })
  await sleep(500)
  await page.screenshot({ path: `${OUT}/11-learned.png` })
  if ((await page.$$('.learn-card .word-tile')).length < 1) errors.push('「あたらしく おぼえたよ！」に単語の絵が出ていません')
  if (await page.$('.grow-card')) errors.push('はじめてのコースなのに「まえより のびたよ」が出ています')
  await page.waitForSelector('.again-pop', { timeout: 90000 })
  const mySave = () =>
    page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
      return p.list.find((x) => x.id === p.current).save
    })
  const clearedBefore = (await mySave()).cleared
  const reviewIds = (await mySave()).review
  if (!firstTwo.every((id) => reviewIds.includes(id))) errors.push(`最初にまちがえた単語が review に入っていません: ${JSON.stringify(reviewIds)}`)
  console.log(`7a. 手がかり・おぼえたよ: OK（review ${reviewIds.length}語）`)

  // ふくしゅう: タイトルにボタン → 時間ゲージなし → ぜんぶ正解でクリア → review が空に
  const sentBefore = submitted.length
  await start(page, '')
  const btn = await page.$('.review-btn')
  if (!btn) errors.push('review があるのに タイトルに「ふくしゅう」ボタンが出ていません')
  else {
    const label = await btn.evaluate((el) => el.textContent)
    if (!label.includes(`（${reviewIds.length}）`)) errors.push(`ふくしゅうボタンの数がちがう: ${label} / review ${reviewIds.length}`)
    await page.screenshot({ path: `${OUT}/11-title-review.png` })
    await btn.click()
    await sleep(1500)
    if (await page.$('.gauge')) errors.push('ふくしゅうに時間ゲージが出ています')
    if (!(await page.$('.mode-chip'))) errors.push('ふくしゅうの表示が出ていません')
    if (!(await page.$('.road'))) errors.push('ふくしゅうに みちのりが出ていません')
    await page.screenshot({ path: `${OUT}/11-review.png` })
    const n = Math.min(10, reviewIds.length)
    const order = []
    for (let k = 0; k < n && !(await page.$('.banner.clear')); k++) {
      order.push((await currentQ(page)).id)
      await answer(page, k + 10)
      await sleep(400)
      if (k < n - 1) await settle(page)
    }
    // 新しいほうから出る
    if (order.join() !== [...reviewIds].reverse().slice(0, n).join()) errors.push(`ふくしゅうの出題順が review の新しい順ではありません: ${order} / ${reviewIds}`)
    await page.waitForSelector('.banner.clear', { timeout: 30000 })
    await page.waitForSelector('.result-mode', { timeout: 20000 })
    if (await page.$('.result-cleartime')) errors.push('ふくしゅうなのに クリアタイムが出ています')
    await page.waitForSelector('.again-pop', { timeout: 90000 })
    await page.screenshot({ path: `${OUT}/11-review-result.png` })
    if (await page.$('.rank-link')) errors.push('ふくしゅうの結果に らんきんぐのボタンが出ています')
    const after = await mySave()
    if (after.review.length !== 0) errors.push(`ふくしゅうで ぜんぶ正解したのに review が残っています: ${JSON.stringify(after.review)}`)
    if (JSON.stringify(after.cleared) !== JSON.stringify(clearedBefore)) errors.push(`ふくしゅうでコースの解放が変わっています: ${JSON.stringify(after.cleared)}`)
    if (submitted.length !== sentBefore) errors.push('ふくしゅうがランキングに送られています')
  }
  await start(page, '')
  if (await page.$('.review-btn')) errors.push('review が空なのに「ふくしゅう」ボタンが出ています')
  console.log('7b. ふくしゅう: OK')

  // 2回目のプレイ: 前回（かんたん3問）よりせいかい数が増えるので「まえより のびたよ」
  await start(page, '?goal=5&time=60')
  await page.click('.level-btn')
  await sleep(1200)
  for (let i = 0; i < 5; i++) {
    await answer(page, i + 10)
    await sleep(400)
    if (i < 4) await settle(page)
  }
  await page.waitForSelector('.grow-card', { timeout: 90000 })
  await sleep(500)
  await page.screenshot({ path: `${OUT}/11-growth.png` })
  const lines = await page.$$eval('.grow-line', (els) => els.map((e) => e.textContent))
  if (!lines.some((t) => t.startsWith('せいかい 3 → 5'))) errors.push(`「まえより のびたよ」の中身がおかしい: ${JSON.stringify(lines)}`)
  console.log('7c. まえより のびたよ: OK')

  // 8. くもり: save を書きかえて のりもの の単語を ぜんぶ くもり（box=1・due=40日前）にしてから遊ぶ
  const cloudIds = data.questions.filter((q) => q.c === 'のりもの' && (q.img || q.e)).map((q) => q.id)
  await page.evaluate((ids) => {
    const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
    const me = p.list.find((x) => x.id === p.current)
    const t = Date.now() - 40 * 86400000
    for (const id of ids) me.save.stats[id] = { ok: 3, ng: 0, last: t, box: 1, boxAt: t, due: t, firstOkAt: t }
    localStorage.setItem('saru-quiz/players', JSON.stringify(p))
  }, cloudIds)
  await start(page, '?cat=のりもの&goal=3&time=60')
  await page.click('.level-btn')
  await sleep(1500)
  if (!(await page.$('.picture.is-cloudy'))) errors.push('くもりの単語なのに 絵にくもりが出ていません')
  await page.screenshot({ path: `${OUT}/11-cloudy.png` })
  // 最初の答えで正解 → 拭きとる（0.6秒）→ キラッ → 「ぴかぴか！」
  await answer(page, 20)
  await sleep(250)
  if (!(await page.$('.picture.is-wiping'))) errors.push('くもりの絵に正解したのに 拭きとる動きが始まっていません')
  await page.screenshot({ path: `${OUT}/11-wiping.png` })
  // 0.6秒たったら くもりが消えて、吹き出しが「ぴかぴか！」になる
  await page
    .waitForFunction(() => document.querySelector('.bubble')?.textContent === 'ぴかぴか！' && document.querySelector('.picture.correct') && !document.querySelector('.picture.is-cloudy'), { polling: 30, timeout: 4000 })
    .catch(() => errors.push('拭きとったあと くもりが消えて「ぴかぴか！」になっていません'))
  await sleep(150)
  await page.screenshot({ path: `${OUT}/11-polished.png` })
  await page.waitForFunction(() => !document.querySelector('.choice.is-answer'), { timeout: 30000 })
  await sleep(300)
  // まちがえたときは くもりはそのまま（罰はなし）
  if (!(await page.$('.picture.is-cloudy'))) errors.push('次のくもりの単語に くもりが出ていません')
  await answer(page, 21, true)
  await sleep(600)
  if (!(await page.$('.picture.wrong.is-cloudy'))) errors.push('まちがえたのに くもりが消えています')
  console.log('8. くもり・ぴかぴか: OK')

  // 9. 7枚そろう＋バナナのやま。今日の えにっきを消して、シールを6枚・バナナを トラックの手前にしてから遊ぶ
  const truck = BANANA_STAGES[3]
  await start(page, '')
  await page.evaluate((need) => {
    const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
    const me = p.list.find((x) => x.id === p.current)
    const d = new Date()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    delete me.save.diary[key]
    me.save.stickers = 6
    me.save.coins = need - 5
    localStorage.setItem('saru-quiz/players', JSON.stringify(p))
  }, truck.need)
  await start(page, '?goal=3&time=60')
  if (!(await page.$('.title .pile-mini .pile-base-svg'))) errors.push('タイトルの バナナのやま（ねこぐるま）が出ていません')
  await page.screenshot({ path: `${OUT}/14-title-nekoguruma.png` })
  await page.click('.level-btn')
  await sleep(1200)
  for (let i = 0; i < 3; i++) {
    await answer(page, i + 30)
    await sleep(400)
    if (i < 2) await settle(page)
  }
  await page.waitForSelector('.sticker-card', { timeout: 90000 })
  if (!(await page.$('.sticker-card.complete'))) errors.push('7枚目なのに「ぜんぶ そろったよ」になっていません')
  if ((await page.$$('.sticker-card .sticker-slot.got')).length !== 7) errors.push('7枚そろったのに 台紙が7枚うまっていません')
  await sleep(1800)
  await page.screenshot({ path: `${OUT}/14-sticker-complete.png` })
  await page.waitForSelector('.banana-card', { timeout: 30000 })
  const bt = await page.$eval('.banana-card .learn-title', (el) => el.textContent)
  if (!bt.includes('トラックいっぱい')) errors.push(`バナナのやまのカードが トラックではありません: ${bt}`)
  if (!(await page.$('.banana-card .pile .pile-b'))) errors.push('バナナのやまの絵が出ていません')
  await sleep(1200)
  await page.screenshot({ path: `${OUT}/14-banana-card.png` })
  await page.waitForSelector('.again-pop', { timeout: 30000 })
  const sv9 = await mySave0()
  const d9 = Object.values(sv9.diary).find((d) => d.sticker !== undefined)
  if (sv9.stickers !== 7 || d9?.sticker !== 6) errors.push(`7枚目のシールが保存されていません: stickers=${sv9.stickers} sticker=${d9?.sticker}`)
  if (sv9.coins < truck.need) errors.push(`バナナが トラックに届いていません: ${sv9.coins}`)
  await start(page, '')
  if (!(await page.$eval('.title .pile-mini', (el) => el.textContent)).includes('🚚')) errors.push('タイトルの バナナのやまが トラックになっていません')
  await page.screenshot({ path: `${OUT}/14-title-truck.png` })
  // 段階が変わらないプレイでは、バナナのカードは出ない（同じ日の2回目はシールも出ない）
  await start(page, '?goal=3&time=60')
  await page.click('.level-btn')
  await sleep(1200)
  for (let i = 0; i < 3; i++) {
    await answer(page, i + 40)
    await sleep(400)
    if (i < 2) await settle(page)
  }
  await page.waitForSelector('.again-pop', { timeout: 90000 })
  if (await page.$('.banana-card')) errors.push('段階が変わっていないのに バナナのやまのカードが出ています')
  if (await page.$('.sticker-card')) errors.push('同じ日の2回目なのに シールのカードが出ています（9）')
  console.log('9. 7枚そろう・バナナのやま: OK')
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) {
  console.error('❌ エラー:', errors)
  process.exit(1)
}
console.log(`✅ スモークテストOK（スクショ: ${OUT}/）`)
