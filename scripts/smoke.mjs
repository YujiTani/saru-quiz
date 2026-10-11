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
//  8. えんしゅつ図鑑: タイトルの並び（アイコンの1行・ロゴと重ならない）→ ずかん（タブ9つ・集計・影のカード・もうすぐ）→ ためす → こてい/おまかせ（15-*.png）
// 10. でてくる・おうえん: クイズ画面に出る（5種・3種。ふちの観客が選択肢・リーチのおさると重ならない）→ ハプニング（?hap=hap:ufo で2問目に起きる・
//     「みつけた！」のバッジ・選択肢はおせる）→ ふつうに遊んで seen が保存されてプレゼントに出る → ずかんで でてくる・おうえん・ハプニングが「ためす」で動く（17-*.png）
// 11. ことば図鑑・れんしゅう・保護者メニュー（段階5a。18-*.png）: 集計・タブ21・影と「？」・くもり → れんしゅう（ハプニングなし・10問・ランキングとコースに入れない）→ 長押しの輪っか → 記録・苦手 → 1語消す（図鑑で影に戻る）→ ぜんぶ消す（2回の確認）。
//     おうえん（おさる・ことり）が 375/390/430px で画面の外に出ないことも
//  9. プレゼント: 解放の直前から遊んで、箱が開く →「あたらしい えんしゅつ！」→ ためす（3つまで・ほかにも N こ）。ふつうに遊んで got の保存も（16-*.png）
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

/** ハプニングは ふつうは日付で起きるので、smoke では 起こさない（?hap=off）。hap を決めたい（または ふつうに起こしたい）ときは opts.hap = false */
async function start(page, query, opts = {}) {
  const q = opts.hap === false || /[?&]hap=/.test(query) ? query : `${query}${query.includes('?') ? '&' : '?'}hap=off`
  await page.goto(`http://localhost:5199/${q}`, { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await sleep(800)
  // はじめてなら キャラをつくる
  if (await page.$('.player-edit')) {
    await typeName(page, 'てすと')
    await page.click('.char-btn:nth-child(5)')
    await page.click('.name-save')
    await sleep(600)
  }
  // はじめてのガイドが出ていたら とばす（ほかのテストのじゃまにならないように）
  if (await page.$('.guide')) {
    await page.click('.guide-skip')
    await sleep(200)
  }
}

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' })
await server.listen()
const { BANANA_STAGES } = await server.ssrLoadModule('/src/lib/banana.ts')
const { SHOWS } = await server.ssrLoadModule('/src/shows/registry.ts')
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
    if ((await page.$eval('.diary-btn .n', (el) => el.textContent).catch(() => '')) !== '1') errors.push('えにっきボタンに シールの枚数（1）が出ていません')
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
  await page.click('.settings-btn')
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
  await page.click('.settings-btn')
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
  await page.click('.rank-btn')
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
  await sleep(900) // 次の問題の「でてくる」演出（0.8秒）が終わるのを待つ
  if ((await page.$$('#show-layer > *')).length !== 0) errors.push('次の問題になっても演出の要素が残っています')
  console.log('5a. うごくえ: OK')

  // ずっこけ: まちがえた直後（くしゃみで帽子がとぶ）→「おしい！ これは、〇〇だよ」→ すぐ次の問題（いないいないばあ（絵の複製が出る）はもうない）
  await start(page, '?show=zukkoke:hakushon&cat=のりもの&time=60')
  await page.click('.level-btn')
  await sleep(1200)
  const wrongQ = await currentQ(page)
  await answer(page, 0, true)
  await sleep(1100)
  await page.screenshot({ path: `${OUT}/9-zukkoke.png` })
  let clones = 0
  for (let i = 0; i < 80 && (await page.$('.choice.is-answer')); i++) {
    clones += (await page.$$('.show-clone')).length
    if (i === 12) await page.screenshot({ path: `${OUT}/9-wrong-flow.png` })
    await sleep(100)
  }
  if (clones > 0) errors.push('まちがえたあとに 絵の複製（いないいないばあ）が出ています')
  if (await page.$('.choice.is-answer')) errors.push('まちがえたあと、次の問題に進みません')
  console.log('5b-1. まちがえたあと: ずっこけ→読み上げ→次へ')
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
    const label = await page.$eval('.review-btn .n', (el) => el.textContent)
    if (label !== String(reviewIds.length)) errors.push(`ふくしゅうボタンの数がちがう: ${label} / review ${reviewIds.length}`)
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

  // 10. えんしゅつ図鑑。どうぶつ・しぜん・がっき を3語ずつおぼえた状態にしてから開く
  const tab3 = (c) => data.questions.filter((q) => q.c === c && q.img).slice(0, 3).map((q) => q.id)
  await start(page, '')
  await page.evaluate((ids) => {
    const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
    const me = p.list.find((x) => x.id === p.current)
    const t = Date.now()
    for (const id of ids) me.save.stats[id] = { ok: 3, ng: 0, last: t, box: 1, boxAt: t, due: t + 86400000, firstOkAt: t }
    me.save.review = ['red-apple']
    me.save.cleared = [1, 2] // むずかしいも出る（ボタンが最大まで並ぶ）
    // キャラも3人にする
    for (const [id, name, char] of [['x2', 'ぷりん', 'sora'], ['x3', 'らてぃ', 'mint']]) if (!p.list.some((x) => x.id === id)) p.list.push({ id, name, char, color: '#38b6ff', save: JSON.parse(JSON.stringify(me.save)) })
    localStorage.setItem('saru-quiz/players', JSON.stringify(p))
  }, [...tab3('どうぶつ'), ...tab3('しぜん・てんき'), ...tab3('がっき・おと')])
  await start(page, '')
  await sleep(500)
  // タイトル: ボタンが最大まで並んでも、アイコンは1行・ロゴとおさるが重ならない・全部が画面に入る
  const tops = await page.$$eval('.icon-row .icon-btn', (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  if (tops.length !== 7 || new Set(tops).size !== 1) errors.push(`タイトルのアイコンが1行に7つ並んでいません: ${JSON.stringify(tops)}`)
  const lay = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const hero = r('.player-hero img')
    return { logoBottom: r('.logo')?.bottom, heroTop: hero?.top, heroBox: r('.player-hero')?.top, iconsBottom: r('.icon-row')?.bottom, creditBottom: r('.credit')?.bottom, vh: innerHeight, levels: document.querySelectorAll('.level-btn').length }
  })
  if (lay.levels !== 3) errors.push(`ボタンが最大まで並んでいません（コース ${lay.levels}）`)
  if (lay.heroBox < lay.logoBottom) errors.push(`タイトルで ロゴとおさるが重なっています: logo ${lay.logoBottom} / hero ${lay.heroBox}`)
  if (lay.creditBottom > lay.vh) errors.push(`タイトルが画面からはみ出しています: ${lay.creditBottom} > ${lay.vh}`)
  await page.screenshot({ path: `${OUT}/15-title.png` })
  await page.click('.book-btn')
  await sleep(700)
  if ((await page.$$('.book-tab')).length !== 9) errors.push('ずかんのタブが9つではありません')
  const owned0 = await page.evaluate(() => document.querySelectorAll('.book-card.own').length)
  const total = SHOWS.length
  const sumAll = await page.$eval('.sum-all', (el) => el.parentElement.textContent.replace(/\s+/g, ''))
  if (!sumAll.endsWith(`/${total}`)) errors.push(`ずかんの全体の数がちがう: ${sumAll} / ${total}`)
  const ugokuTab = await page.$eval('.book-tab[data-cat="ugoku"] .tab-n', (el) => el.textContent)
  if (ugokuTab !== `${owned0}/22`) errors.push(`うごくえタブの集計がちがう: ${ugokuTab} / 手に入れたカード ${owned0}`)
  if (!(await page.$('.book-card.own[data-id="ugoku:doubutsu"]')) || !(await page.$('.book-card.own[data-id="ugoku:tenki"]')) || !(await page.$('.book-card.own[data-id="ugoku:gakki"]'))) errors.push('3語おぼえたカテゴリの うごくえが ずかんで手に入っていません')
  // まだのもの: 影（brightness(0)）と「？？？」・親向けのヒント
  const lock = await page.$eval('.book-card.locked', (el) => ({ name: el.querySelector('.card-name').textContent, hint: el.querySelector('.card-hint')?.textContent ?? '', filter: getComputedStyle(el.querySelector('.card-icon')).filter }))
  if (lock.name !== '？？？' || !lock.hint || !lock.filter.includes('brightness(0)')) errors.push(`まだのカードが 影＋？？？＋ヒントになっていません: ${JSON.stringify(lock)}`)
  // 9つのタブには ぜんぶ カードがある（もうすぐ は出ない）。でてくるは はじめから1つ
  await page.click('.book-tab[data-cat="deteku"]')
  await sleep(300)
  if (await page.$('.book-soon')) errors.push('でてくるのタブが「もうすぐ」のままです')
  if ((await page.$$('.book-card[data-id^="deteku:"]')).length !== 5) errors.push('でてくるのタブが5枚ではありません')
  await page.screenshot({ path: `${OUT}/15-book-deteku.png` })
  await page.click('.book-tab[data-cat="ugoku"]')
  await sleep(300)
  if (await page.$('.pin-btn')) errors.push('うごくえに「こてい」ボタンが出ています')
  // ためす: 手に入れたカードをタップ → 舞台で再生される（絵の複製が動く）
  await page.click('.book-card.own[data-id="ugoku:doubutsu"]')
  await page.waitForSelector('#show-layer .show-clone', { timeout: 8000 }).catch(() => errors.push('ずかんで「ためす」を押しても 演出が再生されません'))
  await sleep(500)
  await page.screenshot({ path: `${OUT}/15-book-try.png` })
  await page.click('.book-card.own[data-id="ugoku:tenki"]')
  await sleep(1500)
  await page.screenshot({ path: `${OUT}/15-book-tenki.png` })
  // こてい / おまかせ（ずっこけ）
  const myPick = () => page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
    return p.list.find((x) => x.id === p.current).save.shows.pick
  })
  await page.click('.book-tab[data-cat="zukkoke"]')
  await sleep(300)
  await page.click('.book-card.own[data-id="zukkoke:hakushon"]')
  await sleep(300)
  await page.click('.pin-btn')
  await sleep(300)
  if ((await myPick()).zukkoke !== 'zukkoke:hakushon') errors.push(`「こてい」が保存されていません: ${JSON.stringify(await myPick())}`)
  if (!(await page.$('.book-card[data-id="zukkoke:hakushon"].is-picked .card-mark'))) errors.push('固定したカードに「えらんでる」の印が出ていません')
  await page.screenshot({ path: `${OUT}/15-book-pinned.png` })
  await page.click('.pin-btn')
  await sleep(300)
  if ((await myPick()).zukkoke !== 'auto') errors.push(`もう一度押しても「おまかせ」にもどりません: ${JSON.stringify(await myPick())}`)
  if (await page.$('.book-card.is-picked')) errors.push('おまかせにもどしたのに「えらんでる」が残っています')
  // みちのり・おんがくは 舞台が変わる（Road / おさるバンド）
  await page.click('.book-tab[data-cat="michi"]')
  await sleep(300)
  await page.click('.book-card.own[data-id="michi:jungle"]')
  await sleep(1200)
  if (!(await page.$('.pv-stage .road'))) errors.push('みちのりの「ためす」に Road が出ていません')
  await page.screenshot({ path: `${OUT}/15-book-michi.png` })
  await page.click('.book-tab[data-cat="ongaku"]')
  await sleep(300)
  await page.click('.book-card.own[data-id="ongaku:march"]')
  await sleep(2500)
  if (!(await page.$('.pv-stage .band-mk'))) errors.push('おんがくの「ためす」に おさるバンドが出ていません')
  await page.click('.book-back')
  await sleep(400)
  if (!(await page.$('.title'))) errors.push('ずかんの「もどる」でタイトルにもどりません')
  console.log('10. えんしゅつ図鑑: OK')

  // 11. プレゼント。解放の直前の状態（どうぶつ2語・☆19・遊んだ日1日・バナナ590）から ?cat=どうぶつ で3問クリア
  //   → ugoku:doubutsu・zukkoke:guruguru・ongaku:komoriuta の3つ ＋「ほかにも 1こ！」（banana:kago）
  const nearUnlock = (dob, birds) =>
    page.evaluate((dob, birds) => {
      const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
      const me = p.list.find((x) => x.id === p.current)
      const t = Date.now()
      me.save.stats = {}
      me.save.diary = { '2020-01-01': { words: [], plays: 1 } }
      me.save.coins = 590
      me.save.shows = { got: {}, seen: {}, pick: {} }
      dob.forEach((id) => (me.save.stats[id] = { ok: 3, ng: 0, last: t, box: 1, boxAt: t, due: t + 86400000, firstOkAt: t }))
      birds.forEach((id, i) => (me.save.stats[id] = { ok: 3, ng: 0, last: t, box: i < 3 ? 5 : 2, boxAt: t, due: t + 86400000, firstOkAt: t }))
      localStorage.setItem('saru-quiz/players', JSON.stringify(p))
    }, dob, birds)
  const dob2 = data.questions.filter((q) => q.c === 'どうぶつ' && q.img).slice(0, 2).map((q) => q.id)
  const birds4 = data.questions.filter((q) => q.c === 'とり' && q.img).slice(0, 4).map((q) => q.id)
  await nearUnlock(dob2, birds4)
  await start(page, `?cat=${encodeURIComponent('どうぶつ')}&goal=3&time=60&seed=3`)
  await page.click('.level-btn')
  await sleep(1200)
  for (let i = 0; i < 3; i++) {
    await answer(page, i + 50)
    await sleep(400)
    if (i < 2) await settle(page)
  }
  const seenGifts = []
  let shotOpen = false
  let shotShow = false
  const deadline = Date.now() + 150000
  while (Date.now() < deadline && !(await page.$('.again-pop').catch(() => null))) {
    const g = await page.$eval('.gift-card', (el) => ({ id: el.dataset.show, phase: [...el.classList].find((c) => c.startsWith('phase-')) })).catch(() => null)
    if (g) {
      if (!seenGifts.includes(g.id)) seenGifts.push(g.id)
      if (g.phase === 'phase-open' && !shotOpen) {
        shotOpen = true
        await page.screenshot({ path: `${OUT}/16-gift-open.png` })
      }
      if (g.phase === 'phase-show' && !shotShow) {
        shotShow = true
        if (!(await page.$('.gift-card .gift-name'))) errors.push('プレゼントに 演出の名前が出ていません')
        await sleep(1200)
        await page.screenshot({ path: `${OUT}/16-gift-show.png` })
      }
    }
    await sleep(250)
  }
  if (seenGifts.join() !== 'ugoku:doubutsu,zukkoke:guruguru,ongaku:komoriuta') errors.push(`プレゼントの順番・数がちがう（3つまで）: ${seenGifts}`)
  const more = await page.$eval('.more-card', (el) => el.textContent).catch(() => '')
  if (!more.includes('ほかにも 1こ')) errors.push(`「ほかにも 1こ！」が出ていません: ${more}`)
  await page.screenshot({ path: `${OUT}/16-gift-end.png` })
  console.log(`11a. プレゼント: ${seenGifts.join(' ')}`)

  // 11b. ふつうに遊ぶ（テスト用URLなし）と、手に入れた記録が保存される。遊んだ日が2日になって ずっこけ ぐるぐる が出る
  await nearUnlock([], [])
  await start(page, '?goal=3&time=60')
  await page.click('.level-btn')
  await sleep(1200)
  for (let i = 0; i < 3; i++) {
    await answer(page, i + 60)
    await sleep(400)
    if (i < 2) await settle(page)
  }
  await page.waitForSelector('.gift-card[data-show="zukkoke:guruguru"]', { timeout: 120000 })
  await page.waitForSelector('.again-pop', { timeout: 120000 })
  const sv11 = await mySave0()
  if (!sv11.shows.got['zukkoke:guruguru']) errors.push(`手に入れた記録（shows.got）が保存されていません: ${JSON.stringify(sv11.shows.got)}`)
  for (const id of ['ugoku:pika', 'zukkoke:slip', 'michi:jungle', 'ongaku:march', 'finale:photo', 'banana:fusa']) if (!sv11.shows.got[id]) errors.push(`はじめから持っている演出が got に入っていません: ${id}`)
  console.log('11b. 手に入れた記録の保存: OK')

  // 12. でてくる・おうえん: クイズ画面に出る
  const dob = encodeURIComponent('どうぶつ')
  const waapi = (sel) => page.$eval(sel, (el) => el.getAnimations().filter((a) => !('animationName' in a)).length).catch(() => -1)
  for (const id of ['kurutto', 'present', 'ki', 'shabon', 'tsuchi']) {
    await start(page, `?show=deteku:${id}&cat=${dob}&goal=10&time=60`)
    await page.click('.level-btn')
    await sleep(160)
    if ((await waapi('.picture')) < 1) errors.push(`でてくる ${id}: 最初の問題の絵に演出が動いていません`)
    await sleep(170)
    await page.screenshot({ path: `${OUT}/17-deteku-${id}.png` })
    if (id === 'kurutto') {
      // 演出が出ている間も 読み上げは止まらない（選択肢の読み上げが進む）
      await page.waitForSelector('.choice.is-reading', { timeout: 10000 }).catch(() => errors.push('でてくる: 演出のあと 選択肢の読み上げが始まりません'))
      if ((await waapi('.picture')) !== 0) errors.push('でてくる: 0.8秒をすぎても 絵の演出が終わっていません')
      if ((await page.$eval('.picture', (el) => getComputedStyle(el).opacity)) !== '1') errors.push('でてくる: 終わっても絵が見えていません')
      if (!(await page.$('.picture-wrap .cheer[data-ouen="osaru"]'))) errors.push('おうえん: おさるおうえんだん（はじめから）が クイズ画面に出ていません')
    }
  }
  console.log('12a. でてくる: OK')

  // おうえん: ふちの観客は 選択肢・リーチのおさるとは重ならない
  const cheerOverlap = () =>
    page.evaluate(() => {
      const wrap = document.querySelector('.picture-wrap').getBoundingClientRect()
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      const boxes = [...document.querySelectorAll('.cheer-item, .cheer-bird')].map((e) => e.getBoundingClientRect())
      const others = [...document.querySelectorAll('.choice, .decide, .reach-crowd .reach-mk')].map((e) => e.getBoundingClientRect())
      const out = []
      boxes.forEach((b, i) => {
        if (others.some((o) => hit(b, o))) out.push(`${i}: 選択肢かリーチのおさると重なる`)
        if (b.left < 0 || b.right > innerWidth) out.push(`${i}: 画面のよこに はみ出す`)
        if (!b.width) out.push(`${i}: 大きさがない`)
      })
      return { n: boxes.length, out, wrapTop: wrap.top, wrapBottom: wrap.bottom }
    })
  // おさる・ことり（E=0.6 / 3羽 → 正解で 4羽）。リーチ（のこり3問）でも重ならない
  await start(page, `?show=ouen:osaru&cat=${dob}&goal=20&start=12&time=90`)
  await page.click('.level-btn')
  await sleep(1500)
  const osaruN = (await page.$$('.cheer-osaru .cheer-item')).length
  if (osaruN < 5) errors.push(`おうえん(おさる): E=0.6 で ${osaruN}匹しかいません`)
  const chO = await cheerOverlap()
  chO.out.forEach((m) => errors.push(`おうえん(おさる) ${m}`))
  await page.screenshot({ path: `${OUT}/17-ouen-osaru.png` })
  await start(page, `?show=ouen:kotori&cat=${dob}&goal=20&start=3&time=90`)
  await page.click('.level-btn')
  await sleep(1500)
  if ((await page.$$('.cheer-bird')).length !== 3) errors.push('おうえん(ことり): start=3 で3羽のはず')
  await answer(page, 81)
  await sleep(1300)
  if ((await page.$$('.cheer-bird')).length !== 4) errors.push('おうえん(ことり): 正解で4羽になるはず')
  const chK = await cheerOverlap()
  chK.out.forEach((m) => errors.push(`おうえん(ことり) ${m}`))
  await page.screenshot({ path: `${OUT}/17-ouen-kotori.png` })
  await start(page, `?show=ouen:osaru&cat=${dob}&goal=6&start=3&time=90`) // のこり3問 = リーチ（画面の下におさる）
  await page.click('.level-btn')
  await sleep(1500)
  if (!(await page.$('.reach-crowd .reach-mk'))) errors.push('リーチのおさるが出ていません（おうえんとの重なり確認）')
  await answer(page, 82)
  await sleep(1200)
  const chR = await cheerOverlap()
  chR.out.forEach((m) => errors.push(`おうえん+リーチ ${m}`))
  await page.screenshot({ path: `${OUT}/17-ouen-reach.png` })
  // 動きの強さ 0: 跳ねずに並ぶだけ
  await page.evaluate(() => localStorage.setItem('saru-quiz/settings', JSON.stringify({ motion: 0 })))
  await start(page, `?show=ouen:osaru&cat=${dob}&goal=20&start=12&time=90`)
  await page.click('.level-btn')
  await sleep(1200)
  if (!(await page.$('.cheer.still'))) errors.push('動きの強さ 0 の おうえんに still が付いていません')
  if ((await page.$$eval('.cheer-mk.hop', (e) => e.length)) !== 0) errors.push('動きの強さ 0 なのに おうえんが跳ねています')
  await page.screenshot({ path: `${OUT}/17-ouen-motion0.png` })
  await page.evaluate(() => localStorage.setItem('saru-quiz/settings', JSON.stringify({ motion: 1 })))
  console.log('12b. おうえん: OK')

  // 13. ハプニング: ?hap=hap:ufo は 2問目の読み上げ中に起きる。「みつけた！」のバッジ・選択肢は押せる・3秒以内に消える・絵がもとにもどる
  await start(page, `?hap=hap:ufo&cat=${dob}&goal=10&time=90`)
  await page.click('.level-btn')
  await sleep(1200)
  await answer(page, 90)
  await page.waitForSelector('.hap-badge', { timeout: 30000 })
  const t13 = Date.now()
  if (!(await page.$eval('.hap-badge', (el) => el.textContent.includes('みつけた'))) ) errors.push('ハプニングの「みつけた！」バッジが出ていません')
  await sleep(900)
  if (!(await page.$('#show-layer .hap-arena'))) errors.push('ハプニングの演出が出ていません')
  const blocked = await page.evaluate(() => [...document.querySelectorAll('.choice')].filter((c) => {
    const r = c.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !el?.closest('.choice')
  }).length)
  if (blocked) errors.push(`ハプニング中に 選択肢が押せません（${blocked}個）`)
  await page.screenshot({ path: `${OUT}/17-hap-ufo.png` })
  await page.waitForFunction(() => !document.querySelector('#show-layer .hap-arena'), { timeout: 6000 }).catch(() => errors.push('ハプニングが終わりません'))
  if (Date.now() - t13 > 3800) errors.push(`ハプニングが3秒を大きくこえています: ${Date.now() - t13}ms`)
  await sleep(300)
  if ((await page.$eval('.picture', (el) => getComputedStyle(el).opacity)) !== '1' || (await page.$eval('.picture', (el) => getComputedStyle(el).transform)) !== 'none') errors.push('ハプニング（UFO）のあと 絵がもとにもどっていません')
  await page.waitForFunction(() => !document.querySelector('.hap-badge'), { timeout: 4000 }).catch(() => errors.push('「みつけた！」のバッジが消えません'))
  console.log('13a. ハプニング（?hap）: OK')

  // 13b. ふつうに遊ぶ（?hap なし）と、日付で決まるハプニングが起きて seen が保存され、プレゼントに出る。
  //   今を、そのキャラで 2〜3問目に起きる日（planHappening で探す）にして遊ぶ
  const { planHappening } = await server.ssrLoadModule('/src/shows/hapPlan.ts')
  const { HAP_IDS } = await server.ssrLoadModule('/src/shows/happening.ts')
  const { dayKey } = await server.ssrLoadModule('/src/lib/day.ts')
  const pid = await page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/players')).current)
  let fake = null
  for (let d = 0; d < 400 && !fake; d++) {
    const t = new Date(2031, 0, 1 + d, 12).getTime()
    const plan = planHappening({ day: dayKey(t), charId: pid, plays: 0, seen: {}, goal: 4, ids: HAP_IDS, salt: '' })
    if (plan && plan.at <= 3) fake = { t, plan }
  }
  if (!fake) throw new Error('ハプニングが起きる日が見つかりません')
  const clock = await page.evaluateOnNewDocument((t) => {
    const p0 = performance.now()
    Date.now = () => t + Math.floor(performance.now() - p0) // その日の時刻から進む（画面の key が重ならないように）
  }, fake.t)
  await start(page, '?goal=4&time=120', { hap: false })
  await page.click('.level-btn')
  await sleep(1200)
  let badgeSeen = false
  for (let i = 0; i < 4; i++) {
    await answer(page, 100 + i)
    await sleep(400)
    if (!badgeSeen) badgeSeen = !!(await page.$('.hap-badge'))
    if (i < 3) await settle(page)
  }
  let hapGift = false
  const dl13 = Date.now() + 150000
  while (Date.now() < dl13 && !(await page.$('.again-pop'))) {
    if (!badgeSeen) badgeSeen = !!(await page.$('.hap-badge'))
    if (await page.$(`.gift-card[data-show="${fake.plan.id}"]`)) hapGift = true
    await sleep(250)
  }
  await page.removeScriptToEvaluateOnNewDocument(clock.identifier)
  if (!hapGift) errors.push(`ハプニング ${fake.plan.id} のプレゼント（結果の ShowGift）が出ていません`)
  const sv13 = await mySave0()
  if (!sv13.shows.seen[fake.plan.id]) errors.push(`見たハプニング（shows.seen）が保存されていません: ${JSON.stringify(sv13.shows.seen)}`)
  if (!sv13.shows.got[fake.plan.id]) errors.push('見たハプニングが shows.got に入っていません')
  console.log(`13b. ハプニングの保存・プレゼント: ${fake.plan.id}（${fake.plan.at}問目）バッジ=${badgeSeen}`)

  // 14. ずかん: でてくる・おうえん・ハプニングのタブで「ためす」が動く（ハプニングは ぜんぶ「みつけた」にしておく）
  await page.evaluate((haps) => {
    const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
    const me = p.list.find((x) => x.id === p.current)
    Object.assign(me.save, { stats: {}, plays: 0, cleared: [], coins: 0, diary: { '2020-01-01': { words: [], plays: 1 } } })
    me.save.shows = { got: {}, seen: Object.fromEntries(haps.map((id) => [id, 1])), pick: {} }
    localStorage.setItem('saru-quiz/players', JSON.stringify(p))
  }, HAP_IDS)
  await start(page, '')
  await page.click('.book-btn')
  await sleep(600)
  const tabN = (c) => page.$eval(`.book-tab[data-cat="${c}"] .tab-n`, (el) => el.textContent)
  if ((await tabN('deteku')) !== '1/5' || (await tabN('ouen')) !== '1/2' || (await tabN('happening')) !== '10/10') errors.push(`ずかんの集計がちがう: でてくる ${await tabN('deteku')} / おうえん ${await tabN('ouen')} / ハプニング ${await tabN('happening')}`)
  await page.click('.book-tab[data-cat="deteku"]')
  await sleep(300)
  await page.click('.book-card.own[data-id="deteku:kurutto"]')
  await page.waitForFunction(() => document.querySelector('.pv-stage .picture')?.getAnimations().some((a) => !('animationName' in a)), { timeout: 4000, polling: 50 }).catch(() => errors.push('ずかん: でてくる「ためす」が動きません'))
  await page.screenshot({ path: `${OUT}/17-book-deteku.png` })
  await page.click('.book-tab[data-cat="ouen"]')
  await sleep(300)
  await page.click('.book-card.own[data-id="ouen:osaru"]')
  await page.waitForFunction(() => document.querySelectorAll('.pv-stage .cheer-item').length >= 3, { timeout: 9000 }).catch(() => errors.push('ずかん: おうえん「ためす」で 観客が増えません'))
  await page.screenshot({ path: `${OUT}/17-book-ouen.png` })
  await page.click('.book-tab[data-cat="happening"]')
  await sleep(300)
  if ((await page.$$('.book-card .card-mark.found')).length !== 10) errors.push('ずかん: みつけたハプニングに「みつけた！」の印が10個出ていません')
  for (const id of HAP_IDS) {
    await page.click(`.book-card.own[data-id="${id}"]`)
    await page.waitForSelector('#show-layer .hap-arena', { timeout: 4000 }).catch(() => errors.push(`ずかん: ${id} の「ためす」が動きません`))
    await sleep(900)
    const inside = await page.evaluate(() => {
      const a = document.querySelector('#show-layer .hap-arena')?.getBoundingClientRect()
      const s = document.querySelector('.pv-stage')?.getBoundingClientRect()
      return a && s ? Math.abs(a.left - s.left) < 2 && Math.abs(a.top - s.top) < 2 && Math.abs(a.width - s.width) < 2 && Math.abs(a.height - s.height) < 2 : false
    })
    if (!inside) errors.push(`ずかん: ${id} の舞台が ずかんの舞台と合っていません`)
    if (id === 'hap:ufo' || id === 'hap:kujira') await page.screenshot({ path: `${OUT}/17-book-${id.replace(':', '-')}.png` })
    await page.waitForFunction(() => !document.querySelector('#show-layer .hap-arena'), { timeout: 5000 }).catch(() => errors.push(`ずかん: ${id} が終わりません`))
  }
  console.log('14. ずかん（でてくる・おうえん・ハプニング）: OK')

  // 15. ことば図鑑・れんしゅう・保護者メニュー（段階5a）。まっさらな状態から、どうぶつを14語ぶん あそんだことにして始める
  const { troubleWords, playSummary } = await server.ssrLoadModule('/src/lib/parent.ts')
  const { catCounts, bookTotals } = await server.ssrLoadModule('/src/lib/wordbook.ts')
  const setInput = (sel, v) =>
    page.$eval(sel, (el, v) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, v)
  const mySave15 = () =>
    page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
      return p.list.find((x) => x.id === p.current)
    })
  const dobW = data.questions.filter((q) => q.c === 'どうぶつ' && q.img)
  const tabeW = data.questions.filter((q) => q.c === 'たべもの' && q.img)
  const seed15 = () =>
    page.evaluate((dob, tabe) => {
      const p = JSON.parse(localStorage.getItem('saru-quiz/players'))
      const me = p.list.find((x) => x.id === p.current)
      const t = Date.now()
      const D = 86400000
      const key = (ms) => {
        const d = new Date(ms)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      const stats = {}
      dob.slice(0, 14).forEach((id, i) => (stats[id] = { ok: 3 + i, ng: i % 4, last: t, box: 1 + (i % 4), boxAt: t, due: t + 5 * D, firstOkAt: t }))
      stats[dob[2]] = { ok: 3, ng: 1, last: t - 80 * D, box: 2, boxAt: t - 80 * D, due: t - 77 * D } // くもり
      stats[dob[4]] = { ok: 0, ng: 3, last: t, box: 0, due: t } // 出たけど まだ☆なし
      tabe.slice(0, 3).forEach((id) => (stats[id] = { ok: 2, ng: 5, last: t, box: 0, due: t })) // にがて
      Object.assign(me.save, { stats, review: [dob[0], dob[4]], plays: 14, coins: 1200, cleared: [1], stickers: 3, shows: { got: {}, seen: {}, pick: {} } })
      me.save.diary = { [key(t)]: { words: [], plays: 2 }, [key(t - D)]: { words: [], plays: 1 }, [key(t - 3 * D)]: { words: [], plays: 3 } }
      localStorage.setItem('saru-quiz/players', JSON.stringify(p))
    }, dobW.map((q) => q.id), tabeW.map((q) => q.id))
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0' })
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.clear())
  await start(page, '')
  await seed15()
  await start(page, '')
  const me15 = await mySave15()
  const sv0 = me15.save

  // 15a. タイトルの新しいアイコン行: 6つが1行・画面に入る・重ならない（どの画面幅でも）
  for (const w of [375, 390, 430]) {
    await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await sleep(300)
    const row = await page.evaluate(() => {
      const bs = [...document.querySelectorAll('.icon-row .icon-btn')].map((b) => ({ r: b.querySelector('.ic').getBoundingClientRect(), lb: b.querySelector('.lb'), b: b.getBoundingClientRect() }))
      return { n: bs.length, tops: bs.map((x) => Math.round(x.r.top)), left: bs[0]?.r.left, right: bs[bs.length - 1]?.r.right, vw: innerWidth, overlap: bs.some((x, i) => i > 0 && x.r.left < bs[i - 1].r.right - 0.5), clipped: bs.filter((x) => x.lb.scrollWidth > x.b.width + 1).length }
    })
    if (row.n !== 7 || new Set(row.tops).size !== 1) errors.push(`タイトルのアイコンが1行に7つ並んでいません（${w}px）: ${JSON.stringify(row)}`)
    if (row.left < 0 || row.right > row.vw || row.overlap || row.clipped) errors.push(`タイトルのアイコン行がはみ出す・重なる（${w}px）: ${JSON.stringify(row)}`)
    if (w === 375) await page.screenshot({ path: `${OUT}/18-title-375.png` })
    if (w === 390) await page.screenshot({ path: `${OUT}/18-title.png` })
  }
  if (!(await page.$('.words-btn'))) errors.push('タイトルに「ことば」ボタン（.words-btn）がありません')

  // 15b. ことば図鑑: 集計・タブ21・カード（出た単語は絵と名前と☆・くもり・まだは影と「？」）・タップで読み上げ＋うごくえ
  await page.click('.words-btn')
  await page.waitForSelector('.words', { timeout: 5000 })
  await sleep(500)
  const tot = bookTotals(sv0.stats)
  const wtl = await page.$eval('.wt-learned', (el) => Number(el.textContent))
  const wts = await page.$eval('.wt-stars', (el) => Number(el.textContent))
  if (wtl !== tot.learned || wts !== tot.stars || !tot.learned) errors.push(`ことば図鑑の全体の集計がちがう: おぼえた ${wtl}/${tot.learned} ☆ ${wts}/${tot.stars}`)
  const tabsTxt = await page.$$eval('.word-tabs .book-tab', (els) => els.map((e) => [e.dataset.cat, e.querySelector('.tab-n').textContent]))
  const want = catCounts(sv0.stats).map((c) => [c.name, `${c.learned}/${c.total}`])
  if (tabsTxt.length !== 21 || JSON.stringify(tabsTxt) !== JSON.stringify(want)) errors.push(`ことば図鑑のタブ（21）と数がちがう: ${JSON.stringify(tabsTxt)}`)
  if ((await page.$eval('.word-tabs', (el) => getComputedStyle(el).overflowX)) !== 'auto') errors.push('ことば図鑑のタブが横にスクロールできません')
  const onTab = await page.$eval('.word-tabs .book-tab.is-on', (el) => el.dataset.cat)
  if (onTab !== 'どうぶつ') errors.push(`はじめに開くカテゴリが 出た単語のいちばん多い どうぶつ ではありません: ${onTab}`)
  const cards = await page.$$eval('.word-card', (els) => els.map((e) => ({ id: e.dataset.id, own: e.classList.contains('own'), name: e.querySelector('.wc-name').textContent, stars: e.querySelector('.wc-stars').textContent, cloudy: e.querySelector('.wc-pic').classList.contains('is-cloudy'), label: e.getAttribute('aria-label'), filter: getComputedStyle(e.querySelector('.wc-pic > *')).filter })))
  const dobAll = data.questions.filter((q) => q.c === 'どうぶつ' && (q.img || q.e))
  if (cards.length !== dobAll.length) errors.push(`どうぶつのカードが${dobAll.length}枚ではなく${cards.length}枚です`)
  const ownCards = cards.filter((c) => c.own)
  if (ownCards.length !== 14) errors.push(`出た単語のカードが14枚ではありません: ${ownCards.length}`)
  for (const c of ownCards) {
    const q = data.questions.find((x) => x.id === c.id)
    const st = sv0.stats[c.id]
    if (c.name !== q.a || c.stars !== '☆'.repeat(st.box) || c.filter !== 'none') errors.push(`出た単語のカードがちがう: ${JSON.stringify(c)} / box=${st.box}`)
  }
  if (cards.filter((c) => c.cloudy).length !== 1 || !cards.find((c) => c.id === dobW[2].id)?.cloudy) errors.push('くもりの単語（1つ）に雲もようが付いていません')
  if (!(await page.$eval('.word-card .wc-pic.is-cloudy', (el) => getComputedStyle(el, '::after').backgroundImage.includes('radial-gradient')))) errors.push('くもりの雲もようが描かれていません')
  const lockedCards = cards.filter((c) => !c.own)
  for (const c of lockedCards) {
    const q = data.questions.find((x) => x.id === c.id)
    if (c.name !== '？' || c.stars !== '' || !c.filter.includes('brightness(0)') || !c.filter.includes('opacity(0.25)') || c.label.includes(q.a)) errors.push(`まだの単語が 影＋「？」になっていない（答えが見える）: ${JSON.stringify(c)}`)
  }
  // タップ: 出た単語は 舞台にその絵が入って うごくえが動く。まだの単語は何も起きない（舞台もそのまま）
  const own1 = ownCards[1]
  await page.click(`.word-card[data-id="${own1.id}"]`)
  await sleep(1300)
  const stageSrc = await page.$eval('.pv-stage .picture img', (el) => el.getAttribute('src'))
  if (stageSrc !== data.questions.find((x) => x.id === own1.id).img) errors.push(`ことば図鑑: タップした単語の絵が舞台に入っていません: ${stageSrc}`)
  const stageRan = await page.evaluate(() => document.querySelectorAll('#show-layer > *').length > 0 || document.querySelector('.pv-stage .picture')?.getAnimations().length > 0)
  if (!stageRan) errors.push('ことば図鑑: 出た単語をタップしても うごくえが動きません')
  if (!(await page.$(`.word-card.is-sel[data-id="${own1.id}"]`))) errors.push('ことば図鑑: タップしたカードが選ばれていません')
  await page.screenshot({ path: `${OUT}/18-words.png` })
  await sleep(1500)
  await page.click(`.word-card.locked[data-id="${lockedCards[0].id}"]`)
  await sleep(500)
  if (!(await page.$(`.word-card.is-sel[data-id="${own1.id}"]`)) || (await page.$('.word-card.locked.is-sel'))) errors.push('ことば図鑑: まだの単語を タップして 選ばれてしまいました')
  if ((await page.$eval('.pv-stage .picture img', (el) => el.getAttribute('src'))) !== stageSrc) errors.push('ことば図鑑: まだの単語を タップして 舞台の絵が変わりました（答えが見える）')
  // タブを切りかえる。まだ なにも出ていないカテゴリは全部が影、れんしゅうボタンは出る
  await page.click('.word-tabs .book-tab[data-cat="たべもの"]')
  await sleep(500)
  const tabeTotal = Number(want.find((w) => w[0] === 'たべもの')[1].split('/')[1])
  if ((await page.$$('.word-card.own')).length !== 3 || (await page.$$('.word-card.locked')).length !== tabeTotal - 3) errors.push('ことば図鑑: たべもののカードの出た/まだの数がちがう')
  if (!(await page.$('.practice-btn'))) errors.push('ことば図鑑: れんしゅうボタンが出ていません')
  await page.click('.word-tabs .book-tab[data-cat="かたち"]')
  await sleep(400)
  if ((await page.$$('.word-card.own')).length !== 0) errors.push('ことば図鑑: かたちは まだ出ていないはず')
  await page.screenshot({ path: `${OUT}/18-words-locked.png` })
  console.log('15a-b. ことば図鑑: OK')

  // 15c. れんしゅう（1）: ハプニングが起きる日・時刻に始めても 起こさない。✕でことば図鑑のそのカテゴリに戻る
  let fake15 = null
  for (let d = 0; d < 400 && !fake15; d++) {
    const t = new Date(2032, 0, 1 + d, 12).getTime()
    const plan = planHappening({ day: dayKey(t), charId: me15.id, plays: 0, seen: {}, goal: 10, ids: HAP_IDS, salt: '' })
    if (plan && plan.at <= 3) fake15 = { t, plan }
  }
  if (!fake15) throw new Error('ハプニングが起きる日が見つかりません（れんしゅうの確認用）')
  const clock15 = await page.evaluateOnNewDocument((t) => {
    const p0 = performance.now()
    Date.now = () => t + Math.floor(performance.now() - p0) // その日の時刻から進む（画面の key が重ならないように）
  }, fake15.t)
  await start(page, '', { hap: false })
  await page.click('.words-btn')
  await page.waitForSelector('.words')
  await page.click('.practice-btn')
  await page.waitForSelector('.quiz', { timeout: 5000 })
  await sleep(1000)
  for (let i = 0; i < fake15.plan.at + 1; i++) {
    if ((await page.$('.hap-badge')) || (await page.$('#show-layer .hap-arena'))) errors.push('れんしゅうなのに ハプニングが起きました')
    await answer(page, 200 + i)
    await sleep(400)
    if (i < fake15.plan.at) await settle(page)
  }
  await sleep(500)
  if ((await page.$('.hap-badge')) || (await page.$('#show-layer .hap-arena'))) errors.push('れんしゅうなのに ハプニングが起きました（2）')
  await page.click('.quit')
  await page.waitForSelector('.words', { timeout: 5000 })
  if ((await page.$eval('.word-tabs .book-tab.is-on', (el) => el.dataset.cat)) !== 'どうぶつ') errors.push('れんしゅうをやめたとき ことば図鑑の どうぶつ に戻っていません')
  await page.removeScriptToEvaluateOnNewDocument(clock15.identifier)
  console.log(`15c. れんしゅうはハプニングを起こさない（${fake15.plan.at}問目の日）: OK`)

  // 15d. れんしゅう（2）: どうぶつだけ10問・時間ゲージなし・1回まちがえると あとで出なおし・全部あててクリア・ランキングとコースに入れない
  await start(page, '')
  await page.click('.words-btn')
  await page.waitForSelector('.words')
  await page.click('.practice-btn')
  await page.waitForSelector('.quiz', { timeout: 5000 })
  await sleep(1200)
  const chip = await page.$eval('.mode-chip', (el) => el.textContent)
  if (!chip.includes('れんしゅう')) errors.push(`れんしゅうの表示が出ていません: ${chip}`)
  if (await page.$('.gauge')) errors.push('れんしゅうに時間ゲージが出ています')
  if ((await page.$$('.choice')).length !== 3) errors.push('れんしゅうの選択肢が3つ（どうぶつのレベル最大=3）ではありません')
  const submittedBefore = submitted.length
  const seenQ = []
  let wrongId = null
  let rounds = 0
  while (!(await page.$('.banner.clear')) && rounds < 14) {
    const q = await currentQ(page)
    seenQ.push(q.id)
    if (q.c !== 'どうぶつ') errors.push(`れんしゅうに ほかのカテゴリの問題が出ました: ${q.a}（${q.c}）`)
    const wrong = rounds === 2
    if (wrong) wrongId = q.id
    await answer(page, 300 + rounds, wrong)
    rounds++
    await sleep(400)
    if (rounds === 3) await page.screenshot({ path: `${OUT}/18-practice.png` })
    await page.waitForFunction(() => !document.querySelector('.choice.is-answer') || document.querySelector('.banner.clear'), { timeout: 30000 })
    await sleep(200)
  }
  if (rounds !== 11) errors.push(`れんしゅうは まちがい1回＋正解10回で 11回のはず: ${rounds}`)
  if (seenQ.filter((id) => id === wrongId).length !== 2) errors.push('れんしゅう: まちがえた問題が あとでもう一度出ていません')
  if (new Set(seenQ).size !== 10) errors.push(`れんしゅうの出題が10問ではありません: ${new Set(seenQ).size}`)
  await page.waitForSelector('.banner.clear', { timeout: 20000 })
  await page.waitForSelector('.again-pop', { timeout: 90000 })
  const resChip = await page.$eval('.result-mode', (el) => el.textContent)
  const resTitle = await page.$eval('.result-title', (el) => el.textContent)
  if (!resChip.includes('れんしゅう') || !resTitle.includes('れんしゅう')) errors.push(`れんしゅうの結果に「れんしゅう」の表示がありません: ${resChip} / ${resTitle}`)
  if (await page.$('.result-cleartime')) errors.push('れんしゅうの結果にクリアタイムが出ています')
  if (await page.$('.rank-link')) errors.push('れんしゅうの結果に「らんきんぐを みる」が出ています')
  await page.$eval('.screen.result', (el) => el.scrollTo(0, 0)) // 「れんしゅう」の表示（いちばん上）が見えるように
  await sleep(300)
  await page.screenshot({ path: `${OUT}/18-practice-result.png` })
  if (submitted.length !== submittedBefore) errors.push('れんしゅうがランキングに送られました')
  const me15b = await mySave15()
  const sv1 = me15b.save
  if (JSON.stringify(sv1.cleared) !== JSON.stringify(sv0.cleared) || JSON.stringify(sv1.lastByLevel) !== JSON.stringify(sv0.lastByLevel)) errors.push('れんしゅうが コースの解放・「まえより」に入っています')
  if (sv1.plays !== sv0.plays + 1 || sv1.coins <= sv0.coins) errors.push(`れんしゅうの記録（遊んだ回数・バナナ）がつかない: plays ${sv0.plays}→${sv1.plays} coins ${sv0.coins}→${sv1.coins}`)
  const wrongStat = sv1.stats[wrongId]
  if (!wrongStat || wrongStat.ng < 1 || !sv1.review.includes(wrongId)) errors.push('れんしゅうでまちがえた単語が stats / ふくしゅうに記録されていません')
  if (Object.keys(sv1.stats).filter((id) => !sv0.stats[id]).length < 3) errors.push('れんしゅうで出た単語の stats が増えていません')
  // 「もういっかい」で同じカテゴリの れんしゅうがもう一度始まる。「おわり」で ことば図鑑の同じカテゴリへ
  await page.click('.again-pop .again')
  await page.waitForSelector('.quiz', { timeout: 5000 })
  await sleep(1000)
  if (!(await page.$eval('.mode-chip', (el) => el.textContent.includes('れんしゅう'))) || (await currentQ(page)).c !== 'どうぶつ') errors.push('れんしゅうの「もういっかい」が同じカテゴリのれんしゅうになっていません')
  await page.click('.quit')
  await page.waitForSelector('.words', { timeout: 5000 })
  console.log(`15d. れんしゅう: ${rounds}回答・ランキング送信なし・コース記録なし: OK`)

  // 15e. 保護者メニュー: 短い押しでは開かない・長押し中は輪っかのゲージが回る・2秒で開く
  await start(page, '')
  await page.click('.settings-btn')
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.$eval('.parent-btn', (el) => el.scrollIntoView({ block: 'end' }))
  await sleep(400)
  const hb = await (await page.$('.parent-btn')).boundingBox()
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await sleep(500)
  await page.mouse.up()
  await sleep(300)
  if (await page.$('.parent')) errors.push('保護者メニューが、短い押しで開いてしまいました')
  await page.mouse.down()
  await sleep(1000)
  const prog = Number(await page.$eval('.parent-btn', (el) => el.dataset.progress))
  const arc = await page.$eval('.hold-arc', (el) => Number(getComputedStyle(el).strokeDashoffset.replace('px', '')))
  if (!(prog > 0.3 && prog < 0.8) || !(arc > 0 && arc < 125)) errors.push(`長押しの輪っかのゲージが回っていません: progress=${prog} offset=${arc}`)
  await page.screenshot({ path: `${OUT}/18-hold.png` })
  await sleep(300)
  await page.mouse.up()
  await sleep(300)
  if (await page.$('.parent')) errors.push('保護者メニューが、1.3秒の長押しで開いてしまいました')
  if (Number(await page.$eval('.parent-btn', (el) => el.dataset.progress)) !== 0) errors.push('指をはなしても 輪っかのゲージが もどっていません')
  await page.mouse.down()
  await page.waitForSelector('.parent', { timeout: 4000 }).catch(() => errors.push('2秒の長押しで保護者メニューが開きません'))
  await page.mouse.up()
  await sleep(400)

  // 15f. 保護者メニューの中身: 記録の数字・最近7日の棒・苦手なことば（ng が多い順）
  const sv2 = (await mySave15()).save
  const sum = playSummary(sv2, Date.now())
  const shown = await page.$$eval('.pstat', (els) => Object.fromEntries(els.map((e) => [e.dataset.stat, Number(e.querySelector('b').textContent)])))
  if (JSON.stringify(shown) !== JSON.stringify({ days: sum.days, plays: sum.plays, learned: sum.learned, stars: sum.stars, cloudy: sum.cloudy, correct: sum.correct })) errors.push(`保護者メニューの記録の数字がちがう: ${JSON.stringify(shown)} / ${JSON.stringify(sum)}`)
  if (!sum.days || !sum.learned || !sum.stars || !sum.correct) errors.push(`保護者メニューの確認用データが空です: ${JSON.stringify(sum)}`)
  const week = await page.$$eval('.week-row', (els) => els.map((e) => [e.dataset.day, Number(e.querySelector('.wk-n').textContent), Math.round(parseFloat(e.querySelector('.wk-bar i').style.width))]))
  if (week.length !== 7) errors.push(`最近7日の棒が7本ではありません: ${week.length}`)
  const todayPlays = Object.values(sv2.diary).reduce((a, d) => a + d.plays, 0)
  if (week.reduce((a, w) => a + w[1], 0) !== todayPlays || Math.max(...week.map((w) => w[2])) !== 100 || week.some((w) => (w[1] === 0) !== (w[2] === 0))) errors.push(`最近7日の棒がちがう: ${JSON.stringify(week)} / diary ${todayPlays}`)
  const troubleDom = await page.$$eval('.trouble-item', (els) => els.map((e) => e.dataset.id))
  const troubleWant = troubleWords(sv2.stats, 10).map((t) => t.q.id)
  if (troubleDom.length === 0 || JSON.stringify(troubleDom) !== JSON.stringify(troubleWant)) errors.push(`苦手なことばの並びがちがう: ${JSON.stringify(troubleDom)}`)
  await page.screenshot({ path: `${OUT}/18-parent.png` })
  await page.$eval('[data-sec="trouble"]', (el) => el.scrollIntoView({ block: 'start' }))
  await sleep(300)
  await page.screenshot({ path: `${OUT}/18-parent-trouble.png` })
  console.log('15e-f. 保護者メニュー（長押し・記録・苦手）: OK')

  // 15g. 1語の記録を消す: 検索して選ぶ → 確認で「やめる」なら消えない → 「消す」で stats・ふくしゅうから消える → ことば図鑑で影にもどる
  const victim = dobW[0] // review にも入っている☆の単語
  await setInput('.pfind-input', victim.a)
  await sleep(300)
  if (!(await page.$(`.pfind-item[data-id="${victim.id}"]`))) errors.push('ことばの記録を消す: 検索で見つかりません')
  await page.click(`.pfind-item[data-id="${victim.id}"]`)
  await sleep(300)
  await page.$eval('.pconfirm', (el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${OUT}/18-parent-clear-word.png` })
  await page.click('.word-keep')
  await sleep(300)
  if (!(await mySave15()).save.stats[victim.id] || (await page.$('.pconfirm'))) errors.push('ことばの記録を消す: 「やめる」なのに消えた（または確認が残った）')
  await page.click(`.pfind-item[data-id="${victim.id}"]`)
  await sleep(200)
  await page.click('.word-del')
  await sleep(400)
  const sv3 = (await mySave15()).save
  if (sv3.stats[victim.id] || sv3.review.includes(victim.id)) errors.push('ことばの記録を消す: stats / ふくしゅうから消えていません')
  if (Object.keys(sv3.stats).length !== Object.keys(sv2.stats).length - 1 || sv3.coins !== sv2.coins || sv3.plays !== sv2.plays) errors.push('ことばの記録を消す: 1語より多く消えた（または他の記録が変わった）')
  if (!(await page.$('.parent-notice'))) errors.push('ことばの記録を消す: 消したお知らせが出ていません')
  const learnedNow = await page.$eval('.pstat[data-stat="learned"] b', (el) => Number(el.textContent))
  if (learnedNow !== sum.learned - 1) errors.push(`消したあと おぼえた単語の数が減っていません: ${sum.learned} → ${learnedNow}`)
  await page.click('.parent .back-btn')
  await page.waitForSelector('.settings:not(.parent)', { timeout: 3000 }).catch(() => errors.push('保護者メニューの「もどる」で せってい画面に戻りません'))
  await page.click('.home-btn')
  await sleep(400)
  await page.click('.words-btn')
  await page.waitForSelector('.words')
  await sleep(400)
  const vcard = await page.$eval(`.word-card[data-id="${victim.id}"]`, (el) => ({ locked: el.classList.contains('locked'), name: el.querySelector('.wc-name').textContent, filter: getComputedStyle(el.querySelector('.wc-pic > *')).filter }))
  if (!vcard.locked || vcard.name !== '？' || !vcard.filter.includes('brightness(0)')) errors.push(`消した単語が ことば図鑑で影に戻っていません: ${JSON.stringify(vcard)}`)
  await page.$eval(`.word-card[data-id="${victim.id}"]`, (el) => el.scrollIntoView({ block: 'center' }))
  await sleep(200)
  await page.screenshot({ path: `${OUT}/18-words-after-clear.png` })
  console.log('15g. 1語の記録を消す: OK')

  // 15h. このキャラの記録をぜんぶ消す: 2回の確認（だんだん強く）・「やめる」で消えない・最後で記録だけが初期化される（なまえ・見た目は残る）
  await start(page, '')
  await page.click('.settings-btn')
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.$eval('.parent-btn', (el) => el.scrollIntoView({ block: 'end' }))
  await sleep(300)
  const hb2 = await (await page.$('.parent-btn')).boundingBox()
  await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2)
  await page.mouse.down()
  await page.waitForSelector('.parent', { timeout: 4000 })
  await page.mouse.up()
  await sleep(300)
  const before = await mySave15()
  const warnStep = (n) => page.$(`.delete-warn[data-step="${n}"]`)
  await page.$eval('.all-del', (el) => el.scrollIntoView({ block: 'center' }))
  await page.click('.all-del')
  await sleep(250)
  if (!(await warnStep(1)) || (await warnStep(2))) errors.push('ぜんぶ消す: 1回目の確認が出ていません')
  await page.click('.all-del')
  await sleep(250)
  if (!(await warnStep(2))) errors.push('ぜんぶ消す: 2回目の確認が出ていません')
  await page.$eval('.all-keep', (el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${OUT}/18-parent-all.png` })
  await page.click('.all-keep')
  await sleep(250)
  if (await page.$('.delete-warn')) errors.push('ぜんぶ消す: 「やめる」で確認が消えません')
  if (JSON.stringify((await mySave15()).save) !== JSON.stringify(before.save)) errors.push('ぜんぶ消す: 「やめる」を押したのに記録が変わりました')
  await page.click('.all-del')
  await sleep(200)
  await page.click('.all-del')
  await sleep(200)
  if (JSON.stringify((await mySave15()).save) !== JSON.stringify(before.save)) errors.push('ぜんぶ消す: 2回の確認のあと 3回目のクリックの前に 消えてしまいました')
  await page.click('.all-del')
  await sleep(500)
  const after = await mySave15()
  const empty = await server.ssrLoadModule('/src/lib/storage.ts').then((m) => m.emptySave())
  if (JSON.stringify(after.save) !== JSON.stringify(empty)) errors.push(`ぜんぶ消した記録が 初期状態ではありません: ${JSON.stringify(after.save).slice(0, 200)}`)
  if (after.name !== before.name || after.char !== before.char || after.color !== before.color || after.id !== before.id) errors.push('ぜんぶ消す: キャラの名前・見た目が変わりました')
  if (!(await page.$('.parent-notice'))) errors.push('ぜんぶ消す: 消したお知らせが出ていません')
  if (await page.$eval('.pstat[data-stat="plays"] b', (el) => el.textContent) !== '0') errors.push('ぜんぶ消したあと 保護者メニューの数字が0になっていません')
  console.log('15h. ぜんぶ消す（2回の確認・やめる・初期化）: OK')

  // 15i. おうえんの観客が、どの画面幅でも画面の外に はみ出さない（左右とも）
  const cheerOut = () =>
    page.evaluate(() => {
      const wrap = document.querySelector('.picture-wrap').getBoundingClientRect()
      const boxes = [...document.querySelectorAll('.cheer-item, .cheer-bird')].map((e) => e.getBoundingClientRect())
      return { n: boxes.length, out: boxes.filter((b) => b.left < 0 || b.right > innerWidth).length, minLeft: Math.min(...boxes.map((b) => b.left)), maxRight: Math.max(...boxes.map((b) => b.right)), vw: innerWidth, wrapLeft: wrap.left }
    })
  for (const w of [375, 390, 430]) {
    await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await start(page, `?show=ouen:kotori&cat=${encodeURIComponent('どうぶつ')}&goal=24&start=3&time=90`)
    await page.click('.level-btn')
    await sleep(1200)
    for (let i = 0; i < 2; i++) {
      await answer(page, 400 + i)
      await sleep(1100)
      if (i < 1) await settle(page)
    }
    const c = await cheerOut()
    if (c.n < 4 || c.out > 0) errors.push(`おうえん(ことり)が画面の外に はみ出しています（${w}px）: ${JSON.stringify(c)}`)
    if (w === 375) await page.screenshot({ path: `${OUT}/18-cheer-375.png` })
    await start(page, `?show=ouen:osaru&cat=${encodeURIComponent('どうぶつ')}&goal=20&start=18&time=90`)
    await page.click('.level-btn')
    await sleep(1500)
    const o = await cheerOut()
    if (o.n < 6 || o.out > 0) errors.push(`おうえん(おさる)が画面の外に はみ出しています（${w}px）: ${JSON.stringify(o)}`)
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  console.log('15i. おうえんが画面の外に出ない（375/390/430）: OK')

  // 19. はじめてのガイド・デモ（段階5b。19-*.png）
  // 19a. はじめての起動: キャラを作るとガイドが出る（3ページ・暗い背景では閉じない・後ろのボタンは押せない）→ とばす → もう出ない → 「？」でまた出る
  await page.evaluate(() => localStorage.clear())
  await page.goto('http://localhost:5199/?hap=off', { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await sleep(800)
  if (await page.$('.guide')) errors.push('キャラを作る前にガイドが出ています')
  await typeName(page, 'がいど')
  await page.click('.char-btn:nth-child(5)')
  await page.click('.name-save')
  await sleep(900)
  if (!(await page.$('.guide'))) errors.push('はじめての起動でキャラを作ったあとに ガイドが出ていません')
  else {
    await page.screenshot({ path: `${OUT}/19-guide-1.png` })
    if (!(await page.$('.g-quiz .g-card img'))) errors.push('ガイド1ページ目に 絵カードの見本がありません')
    await page.mouse.click(4, 4) // 暗い背景
    await sleep(300)
    if (!(await page.$('.guide'))) errors.push('ガイドが 暗い背景を押して閉じました')
    await page.mouse.click(195, 840)
    await page.mouse.click(60, 700) // 後ろのボタンの位置
    await sleep(300)
    if (!(await page.$('.title')) || (await page.$('.quiz'))) errors.push('ガイドの後ろのボタンが押せてしまいました')
    if (await page.$eval('.guide-back', (el) => getComputedStyle(el).visibility) !== 'hidden') errors.push('1ページ目に「もどる」が見えています')
    await page.click('.guide-next')
    await sleep(2500)
    await page.screenshot({ path: `${OUT}/19-guide-2.png` })
    if (!(await page.$('.g-show .pv-stage')) || !(await page.$('.g-show .road'))) errors.push('ガイド2ページ目に うごくえの舞台とみちのりの見本がありません')
    await page.click('.guide-next')
    await sleep(1200)
    await page.screenshot({ path: `${OUT}/19-guide-3.png` })
    if ((await page.$$('.g-sample .sticker')).length < 3) errors.push('ガイド3ページ目に シールの見本がありません')
    if ((await page.$eval('.guide-next', (el) => el.textContent)).trim() !== 'あそぶ！') errors.push('最後のページのボタンが「あそぶ！」ではありません')
    if (await page.$('.guide-skip')) errors.push('最後のページに「とばす」が出ています')
    await page.click('.guide-back')
    await sleep(300)
    if ((await page.$eval('.guide-title', (el) => el.textContent)) !== 'あたると、えが うごくよ！') errors.push('「もどる」で2ページ目に戻っていません')
    await page.click('.guide-skip')
    await sleep(300)
    if (await page.$('.guide')) errors.push('「とばす」でガイドが閉じません')
  }
  const guideSeen = () => page.evaluate(() => JSON.parse(localStorage.getItem('saru-quiz/settings') ?? '{}').guideSeen)
  if ((await guideSeen()) !== true) errors.push('ガイドを見たことが 端末の設定に保存されていません')
  await page.goto('http://localhost:5199/?hap=off', { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await sleep(900)
  if (!(await page.$('.title')) || (await page.$('.guide'))) errors.push('ガイドを見たあとなのに また自動で出ています')
  if (!(await page.$('.guide-btn'))) errors.push('タイトルに「？」（.guide-btn）がありません')
  await page.screenshot({ path: `${OUT}/19-title-guide-btn.png` })
  await page.click('.guide-btn')
  await sleep(500)
  if (!(await page.$('.guide'))) errors.push('「？」を押してもガイドが出ません')
  await page.click('.guide-next')
  await page.click('.guide-next')
  await sleep(300)
  await page.click('.guide-next') // あそぶ！
  await sleep(300)
  if (await page.$('.guide')) errors.push('「あそぶ！」でガイドが閉じません')
  console.log('19a. ガイド（初回・3ページ・背景では閉じない・とばす・？で再表示）: OK')

  // 19b. 設定からデモ: 手が動く → わざとまちがえる → リーチ・夜・フィーバー → クリア → フィナーレ → デモの結果 → 3秒で自動でタイトルへ。記録は何も変わらない
  const snap = () => page.evaluate(() => JSON.stringify(['saru-quiz/players', 'saru-quiz/settings', 'saru-quiz/pending'].map((k) => localStorage.getItem(k))))
  const before19 = await snap()
  await page.click('.settings-btn')
  await sleep(500)
  await page.$eval('.demo-btn', (el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${OUT}/19-settings-demo.png` })
  await page.click('.demo-btn')
  await sleep(1500)
  if (!(await page.$('.quiz')) || !(await page.$('.demo-hand')) || !(await page.$('.gauge'))) errors.push('デモが始まっていない（手・ゲージがない）')
  const seen = { selected: false, wrong: 0, reach: false, fever: false, night: false, clear: false, hand: new Set(), minGauge: 100, hap: false }
  let wasWrong = false
  const shots = new Set()
  const shot = async (name) => {
    if (shots.has(name)) return
    shots.add(name)
    await page.screenshot({ path: `${OUT}/19-demo-${name}.png` })
  }
  const t0 = Date.now()
  while (Date.now() - t0 < 300000 && !(await page.$('.result-demo'))) {
    const st = await page.evaluate(() => {
      const w = document.querySelector('.gauge-fill')?.style.width
      const h = document.querySelector('.demo-hand')?.getBoundingClientRect()
      return {
        selected: !!document.querySelector('.choice.is-selected'),
        wrong: !!document.querySelector('.choice.is-wrong'),
        reach: !!document.querySelector('.reach-crowd .reach-mk'),
        fever: document.body.classList.contains('fever'),
        night: !!document.querySelector('.road.sky-night'),
        clear: !!document.querySelector('.banner.clear'),
        hand: h ? `${Math.round(h.left / 20)},${Math.round(h.top / 20)}` : '',
        gauge: w ? parseFloat(w) : 100,
        band: document.querySelectorAll('.band .band-monkey, .band img').length,
        badge: !!document.querySelector('.hap-badge'),
      }
    })
    if (st.selected && !seen.selected) { seen.selected = true; await shot('hand-select') }
    if (st.wrong && !wasWrong) { seen.wrong++; if (seen.wrong === 1) await shot('wrong') }
    wasWrong = st.wrong
    if (st.reach && !seen.reach) { seen.reach = true; await shot('reach') }
    if (st.fever && !seen.fever) { seen.fever = true; await shot('fever') }
    if (st.night && !seen.night) { seen.night = true; await shot('night') }
    if (st.badge) seen.hap = true
    seen.hand.add(st.hand)
    seen.minGauge = Math.min(seen.minGauge, st.gauge)
    if (st.clear && !seen.clear) {
      seen.clear = true
      await sleep(3600)
      await shot('finale')
    }
    await sleep(250)
  }
  await page.waitForSelector('.result-demo', { timeout: 20000 })
  await sleep(300)
  await page.screenshot({ path: `${OUT}/19-demo-result.png` })
  if (!seen.selected) errors.push('デモ: 手が選択肢を選んでいません')
  if (seen.hand.size < 6) errors.push(`デモ: 手があまり動いていません（${seen.hand.size}か所）`)
  if (seen.wrong !== 2) errors.push(`デモ: わざとまちがえた回数が2ではありません（${seen.wrong}）`)
  if (!seen.reach) errors.push('デモ: リーチが出ていません')
  if (!seen.night) errors.push('デモ: みちのりが夜になっていません')
  if (!seen.fever) errors.push('デモ: フィーバーに入っていません')
  if (!seen.clear) errors.push('デモ: クリアしていません')
  if (!seen.hap) errors.push('デモ: ハプニングの見本が出ていません')
  if (seen.minGauge < 99) errors.push(`デモ: 時間ゲージが減っています（${seen.minGauge}%）`)
  const demoMsg = await page.$eval('.result-demo', (el) => el.textContent)
  if (!demoMsg.includes('デモ')) errors.push('デモの結果に「デモ」の表示がありません')
  await page.waitForSelector('.title', { timeout: 6000 })
  if ((await snap()) !== before19) errors.push('デモのあとで 保存データ（players/settings/pending）が変わっています')
  console.log(`19b. デモ（手・まちがえ${seen.wrong}回・リーチ・夜・フィーバー・クリア・自動でタイトル・記録なし）: OK`)

  // 19c. デモの途中でタップするとタイトルに戻る（始まって600msのタップは無視）。✕でも戻れる。?demo で始まる
  const nSubmitted = submitted.length
  await page.click('.settings-btn')
  await sleep(400)
  await page.click('.demo-btn')
  await sleep(150)
  await page.mouse.click(195, 500)
  await sleep(200)
  if (!(await page.$('.quiz'))) errors.push('デモ: 始まってすぐのタップで戻ってしまいました')
  await sleep(3500)
  await page.mouse.click(195, 500)
  await sleep(500)
  if (!(await page.$('.title')) || (await page.$('.quiz'))) errors.push('デモの途中のタップで タイトルに戻っていません')
  await page.goto('http://localhost:5199/?demo', { waitUntil: 'networkidle0' })
  await page.click('.tap-start')
  await sleep(1500)
  if (!(await page.$('.quiz .demo-hand'))) errors.push('?demo でデモが始まっていません')
  await page.screenshot({ path: `${OUT}/19-demo-url.png` })
  await page.click('.quit')
  await sleep(500)
  if (!(await page.$('.title'))) errors.push('デモの ✕ でタイトルに戻っていません')
  if (submitted.length !== nSubmitted) errors.push('デモがランキングに送られています')
  if ((await snap()) !== before19) errors.push('デモの途中でやめたあとで 保存データが変わっています')
  console.log('19c. デモ（途中のタップ・最初600msは無視・✕・?demo）: OK')
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) {
  console.error('❌ エラー:', errors)
  process.exit(1)
}
console.log(`✅ スモークテストOK（スクショ: ${OUT}/）`)
