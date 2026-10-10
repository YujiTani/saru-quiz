# おさるのなあに？クイズ

3歳の女の子向け「絵を見てモノの名前をあてる」クイズ（iPhone向けPWA、身内に公開）。
Vite + React + TypeScript。サーバーなし・進捗は端末内保存。

## データの流れ
- `data/wordlist.txt` が問題の唯一の正（1000語）。書式は `こたえ | 英語 | レベル | 仮の絵文字`
  - こたえは **ひらがな**（外来語もひらがな＋「ー」）。同じこたえの重複は禁止
  - id は英語から自動生成（`red apple` → `red-apple`）。英語を変えると id が変わるので注意
- `public/illust/<id>.svg` が問題のイラスト（Claude が手描きした SVG）
- `npm run questions` で `src/data/questions.json` を再生成（**wordlist やイラストを変えたら必ず実行**）
- 画像がない問題は仮の絵文字で出題。どちらもない問題は出題されない

## イラスト（SVG）の規約 — いらすとや風
- `viewBox="0 0 256 256"`、背景なし（透明）、題材を中央に大きく（余白 20px 前後）
- りんかく: `stroke="#5b3a29" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`
- 塗り: 明るいパステル寄りのベタ塗り＋**右下に一段暗い影色**（clipPathで形の内側だけ。グラデーション・フィルタ・テキストは使わない）
- 描き込み: つや（白の楕円＋小さい点）、葉脈、ヘタ、模様など「それらしさ」を出す特徴を必ず入れる
- たべもの: 題材を大きく、お皿は小さく下に。料理の決め手（えびの赤いしっぽ、ラーメンのなると等）をはっきり描く
- ハイライトは白の半透明（opacity .5 前後）、ほっぺは `#ff9aa8` opacity .6〜.7
- 目は `#3a2a20` の丸。動物はにっこり・かわいく
- 3歳児が一目で分かる形を最優先（特徴を誇張してよい）。似たものと区別できる特徴を必ず入れる
- 1ファイル 3KB 程度まで

## 読み上げ音声（VOICEVOX・5人）
- 声: ずんだもん / 四国めたん / 春日部つむぎ / もち子さん / ナースロボ＿タイプＴ（設定画面で選ぶ。ID は `src/lib/settings.ts` の `VOICES`）
- セリフ一覧は `scripts/voice_lines.py`、単語は wordlist から。声ごとに `public/voice/<声>/*.mp3` と `src/data/voices/<声>.json` を生成
- エンジン: `~/voicevox_engine/macos-arm64/run`（127.0.0.1:50021）を起動してから `python3 scripts/generate_voices.py --voice all`（不足分だけ作る）
- 新しいセリフをコードで `speak()` するときは voice_lines.py にも追加して全員ぶん生成する（無いと端末の合成音声になる）
- 声は最初のキャッシュに入れず、選んだ声だけ裏で取っておく（`speech.ts` の `warmCache`、`vite.config.ts` の runtimeCaching）
- タイトル画面のクレジット「VOICEVOX:〇〇」は全員ぶん消さない（利用規約）
- キャラクターの声を真似たAI音声（ハチワレ等）は権利者の許可がないので使わない

## ゲームの流れ
- コースごとの時間とクリア条件は `src/lib/quiz.ts` の `COURSE`（かんたん45秒・50問 / ふつう30秒・55問 / むずかしい20秒・60問）
- 時間ゲージは出題・回答中だけ減る。正解で+3秒・まちがいで-3秒。`?time=秒` `?goal=問題数` でテスト用に上書きできる
- ゲージ0 → ピピーッ →「しゅうりょうー！」→ 結果発表（けっかはっぴょうー！→せいかい数→れんぞく→バナナ）
- クリア数に届いたら「くりあー！」→ 結果発表でクリアタイム（実際にかかった時間）も読み上げ
- フィーバーは「ねつ」で9段階（`Quiz.tsx` の `FEVER_THRESH`）。BGMは3段階ごとに変わる
- キャラ（プレイヤー）は1台に3人まで（`src/lib/players.ts`）。なまえ（ひらがな8文字まで）・見た目9種・色・ランキングのID・バナナ・コース解放・問題ごとの記録をキャラごとに持つ。はじめての起動はタップ → キャラづくり。タイトルで切り替え、設定の「なおす」で変更・削除
- 端末共通の設定（こえ・おと・おんりょう）は `src/lib/settings.ts`。音の設定は誤操作防止のため設定画面だけに置く
- **まなびの記録**（出題・手がかり・くもり・ふくしゅう）
  - 出題: `quiz.ts` の `pickSession(level, count, stats, now, rng)`。重みは `leitner.weight`（くもり=5・まだ出ていない=3・段0=2+ng・期限前=0.3・期限すぎ=2）× そのコースのレベルの新しい単語を2倍。同じ単語は1回のプレイに1回だけ
  - 手がかり: `hintFor(まちがい回数)`。1回まちがえた単語が もう一度出たら選択肢を1つ減らす（最低2つ。`makeRound(q, level, hint)`）、2回以上なら 読み上げ終わりに正解の選択肢が ふわっと光る（`.choice.is-hint`、2秒周期）。数えるのは1回のプレイの中だけ
  - くもり: 遊び始めに `isCloudy` の単語を集め、絵に雲もよう（`.picture.is-cloudy::after`）。最初の答えで正解したら 左から右へ0.6秒で拭きとり → 星 →「ぴかぴか！」（まちがいは そのまま・罰なし）。ボーナス問題にはしない
  - ふくしゅう: タイトルの「🔁 ふくしゅう（N）」（`save.review` があるときだけ）。`reviewSession` で新しいほうから最大10問、時間ゲージなし、GOAL＝出題数（みちのり・リーチもこの数）。ランキング・コース解放・「まえより」には入れない。最初の答えで正解した単語は review から外れる。`Quiz` の `mode: 'course' | 'review'` と決まりごとは `quiz.ts` の `MODE_RULES`（あとで practice・demo を足す）
  - 結果: `growthLines(prev, cur, level)`（せいかい数・さいこうれんぞく・クリアタイムが のびた項目だけ。最大3行）を `applyResult` が `events.growth` に入れる。前回は `save.lastByLevel[level]`（コースごと。古いデータの `lastResult` は `normalizeSave` で移す）。結果の最後に「まえより のびたよ」→「あたらしく おぼえたよ」（絵＋☆、タップで読み上げ）→ ☆が増えた・ぴかぴか → 「まだ あそぶー？」
  - 目で確かめる: くもりは `?show` のような強制がないので、smoke のように localStorage の `saru-quiz/players` の stats を書きかえる（box=1・due を40日前）
- **毎日の楽しみ**（きねんしゃしん・えにっき・シール・バナナのやま）
  - きねんしゃしん（`finale:photo`、`shows/finale.ts`）: コースのクリアの「くりあー！」のあと（時間切れは なし）に `chooseShow('finale', …)` で選んで再生。暗くなる → おさる（`getCurrent().char`）とこのプレイで正解した単語（`ctx.today`、新しい8個まで）が ひな壇に並ぶ → 「はい、ちーず！」→ 3・2・1 → フラッシュ（1回だけ・1秒ほどかけて消す。動きの強さ0なら出さない）→ 枠（白い縁・日づけ・テープ）が ぺたっと貼られる。全体 約3.9秒。`#show-layer` の `.photo-scene[data-phase]`（dark → arranged → count → flash → framed。smoke が見る）。ひな壇の並べ方は `lib/riser.ts` の `riserLayout(n)`（純粋。えにっきの日のページも同じ）。フィナーレを増やすときは `FINALE_SHOWS` に足す
  - えにっき（`screens/Diary.tsx`、タイトルの `.diary-btn`）: 月のページ（横7列。遊んだ日だけ その日のシールと小さい絵。遊んでいない日は白いまま・印なし）→ 日をタップで その日のページ（日づけ・しゃしん・遊んだ回数・シール・ことば一覧）。前の月は12か月前まで・今日より先の月には行かない。月の並びは `lib/calendar.ts`（`monthLayout` `monthCells` `addMonth`）。保存は id だけで、写真は毎回組み立てる。`diary[日]` は `{ words（最大30）, plays, mastered（その日 ☆1になった単語。☆を付ける）, sticker（0〜6）}`（古いデータは mastered・sticker がない）
  - シール（`lib/stickers.ts`）: その日はじめて遊び終わったら（ふくしゅうでも）1枚。どうぶつ7種（cat・dog・rabbit・elephant・giraffe・giant-panda・lion）を順番に。`save.stickers` を増やし `diary[日].sticker = (stickers-1) % 7`。休んでも続きから（やり直さない・連続日数は数えない）。`applyResult` の `events.sticker = { kind, count, complete }`。結果の「シールを もらったよ！」カード（回りながら飛んできて ぺたっ。台紙に7枚）、7の倍数で「ぜんぶ そろったよ！」＋紙ふぶき多め
  - バナナのやま（`lib/banana.ts` の `BANANA_STAGES`、演出 `banana:fusa|kago|nekoguruma|truck|fune|shima|hoshi`、絵は `shows/banana.ts` の `pileHtml` と `components/BananaPile.tsx`）: 合計バナナ（`save.coins`）が 0・600・1500・3500・8000・18000・40000 で ひとふさ → かご → ねこぐるま → トラック → ふね → しま → バナナのほし。しきい値は 1回のプレイでもらえる量（3歳が10問前後で 150〜500）から、最初は2〜3回・あとは約2〜2.5倍ずつ。解放は `UnlockCtx.coins`。段階が上がったプレイは `events.bananaUp`（新しい段階）→ 結果に「バナナが 〇〇いっぱいに なったよ！」のカード。タイトルのバナナの数の横に今の段階（`.pile-mini`）。ねこぐるま・ふねは絵文字がないか、端末で絵が切れるので SVG
  - 新しいセリフ: 「はい、ちーず！」「シールを、もらったよ！」「シールが、ぜんぶ、そろったよ！」と バナナのやま各段階の `say`（`banana.test.ts` が voice_lines.py にあるか確かめる）
  - 目で確かめる: smoke の `12-*`（シール・きねんしゃしん）`13-*`（えにっき）`14-*`（7枚そろう・バナナのやま・タイトル）。バナナのやまは localStorage の coins をしきい値の手前に書きかえてから遊ぶ
- **えんしゅつ図鑑と解放の記録**（`screens/ShowBook.tsx`、タイトルの `.book-btn`「🎁 ずかん」）
  - タイトルは まるいアイコンの1行（`.icon-row`: ふくしゅう `.review-btn`・えにっき `.diary-btn`・ずかん `.book-btn`・らんきんぐ `.rank-btn`・せってい `.settings-btn`。数のバッジは `.n`）。ボタンが最大まで並んでも ロゴとおさるが重ならない（smoke の `15-title`）
  - 解放の記録: `applyResult` が 前後の `unlockCtx` を比べ（`shows/book.ts` の `grantShows` / `newlyUnlocked`）、新しく手に入れた演出の id を `save.shows.got[id] = 時刻` に入れて `events.newShows` に返す。はじめから持っているもの（base）や、記録をつける前から持っていたものは、だまって got に入れる（newShows には出さない）。ずかんの「手に入れた」は 解放条件をみたす or got にある（一度手に入れたものは なくならない）。ハプニングは `save.shows.seen` にあれば「みつけた！」
  - プレゼント（`components/ShowGift.tsx`）: 結果の最後（「まだ あそぶー？」の前）。おさるが箱を持ってくる → ゆれる → パカッ → アイコンと名前＋「あたらしい、えんしゅつ！」→ その演出を1回ためす。1回のプレイで3つまで、あとは「ほかにも N こ！」。解放条件は読み上げない
  - ずかん: 上は「ためす」の舞台（`components/ShowStage.tsx` ＋ `shows/preview.ts` の `runPreview`。司会のおさる・吹き出し・絵のカードに、その演出の `play` を `makeCtx({ pic, host, preview: true })` で流す。みちのりは Road を E 0→1、おんがくは `startBgm` → E を上げながら7秒 → `stopBgm`）。タブは `BOOK_CATS`（9つ。0件は「もうすぐ」）、集計は `bookCounts`。まだのカードは 黒い影（`filter: brightness(0)`）と「？？？」＋親向けの小さなヒント（読み上げない）。うごくえ以外は `.pin-btn` で「こてい」⇄「おまかせ」（`save.shows.pick[cat]` = id か 'auto'。固定中のカードに `.card-mark`「えらんでる」）
  - `ShowCtx.preview` が true のとき、`say(ctx, 文, x, y)`（`shows/util.ts`）は吹き出しに加えて読み上げる（ゲーム中は ほめ言葉の読み上げと ぶつかるので 吹き出しだけ）。この言葉は voice_lines.py に足す（「にあう？」「ありがとう！」など）
  - 4b のメモ: でてくる・おうえん・ハプニングは `Show` を登録（`registry.ts` の `SHOWS`）すれば、ずかんのタブ・集計・プレゼント・ためすに自動で出る。ためすの舞台は `.picture` と `.host-monkey` を `ctx.pic` / `ctx.host` で渡している（演出が `document.querySelector` で探すと舞台ではなく クイズ画面を見てしまう）
- **うごくえ**（`shows/ugoku.ts` ＋ `shows/ugokuMore.ts`）: questions.json の21カテゴリすべてに専用の動き＋基本の「ぴかっ」。どれも そのカテゴリの単語を3つおぼえたら。単語や月で変わるもの: てんき `weatherOf`（id → あめ・ゆき・にじ・たいよう・かみなり・かぜ・きらきら）、がっき `lib/instruments.ts` の `instrumentOf` / `PHRASES`（たいこ・ぴあの・らっぱ・すず・木琴）、きせつ `seasonOf(月)`（はる 花びら・なつ 泡・あき 葉っぱ・ふゆ 雪）、ふく `wearsOnHead`（頭のものは頭に重なる）。長い動きは次の問題に入ると片づけられるので、Quiz は 読み上げのあと 最大1.2秒だけ うごくえの終わりを待つ。確かめるのは `node scripts/show_shots.mjs <id>`（単語・月の見分けも `tenki-rain` `gakki-drum` `kisetsu-winter` などで撮れる。`?word=<単語id>` で その1語だけ出題、`?month=N` は show_shots 用）
- **ずっこけ**（8種。`zukkoke:slip|hakushon|guruguru|hiyoko|hanabanana|gunya|puri|neko`）: playDays が 0・0・2・4・6・8・10・12 で手に入る。おさるが自分で変なことをするだけ（痛い・こわい表現なし）
- のこり5秒からは時間の進みが半分（5→0 を10秒かけて大きくカウントダウン）。`Quiz.tsx` の `COUNTDOWN_MS`

## 確認手順（変更したら必ず）
- イラスト追加後: `node scripts/fit_illust.mjs <id…>`（描いた範囲を測って中央・同じ大きさにそろえる。何度実行しても同じ）→ `node scripts/sheet.mjs <カテゴリ名>` → `.sheets/*.png` を目視確認（構文チェック込み）
- コード変更後: `npm run check`（問題JSON再生成 + 単体テスト + 型チェック + iPhoneサイズの通しテスト。スクショは `.smoke/`）
- 単体テスト: `npm run test`（vitest。`src/**/*.test.ts`。進捗・ライトナー式の箱・乱数・日付・シール・バナナの段階・えにっきの月の並び・ひな壇・演出の解放と選び方・ずかんの集計と解放の記録・天気/楽器/季節の見分け。設定は `vitest.config.ts`）。出力の解析に失敗するときは `rtk proxy npx vitest run`（`npm run check` も `rtk proxy npm run check`）
- テスト用のURLパラメータ（`src/lib/testflags.ts`）
  - `?seed=数値` 乱数を固定（`src/lib/rng.ts`。`Math.random` のかわりに `rng()` を使う）
  - `?show=<id>` `?demo` 保存もランキングへの送信もしない
  - `?cat=カテゴリ名` そのカテゴリだけ出題（保存もランキングもなし）
  - `?word=<単語id>` その1語だけ出題（保存もランキングもなし。天気・楽器の見分けの確認用）
  - `?start=数` せいかい数をその数から始める（みちのり・リーチの確認用。記録しない）
  - `?time=秒` `?goal=問題数` は今までどおり（これらは記録する）
- 進捗の更新は `src/lib/progress.ts` の `applyResult`（純粋）。単語の箱（☆・くもり）は `src/lib/leitner.ts`。日付は `src/lib/day.ts`（テストでは `setNow`）
- ヘッドレスChromeは `~/.cache/saru-quiz/` にある（`scripts/browser.mjs`）

## 演出エンジン（`src/shows/`）
- 演出1つ = `Show`（`types.ts`）。`registry.ts` の `SHOWS` に登録し、`base: true` か `unlock(u)` で手に入れる。解放の集計は `unlock.ts` の `unlockCtx(save, now)`
- 選び方: `pickShow(cat, save.shows.pick, u, rng, avoid)`（固定 / おまかせ / 直前を避ける）、うごくえは `ugokuFor(カテゴリ名, u)`。`?show=<id>` はそのカテゴリの演出を必ずその id にする（`index.ts` の `chooseUgoku` / `chooseZukkoke`）
- 再生は `play(show, makeCtx({...}))`。DOM のアニメは `ctx.layer`（`layer.ts`。`#show-layer`、z-index 25）に置き、`layer.go(el, keyframes, opts)`（Web Animations）で動かす。`clear()` で片づけ、次の問題に入る前に Quiz が呼ぶ。clear 後は古い演出が何も置けない
- 動きの強さ（設定 0〜1）は `effects.setMotion`。0 のときは粒子が最大4個・画面ゆれとフラッシュなしで、`layer.go` が「ふわっと光って消えるだけ」にする。1つ増やしたら `MOTION=0 node scripts/show_shots.mjs <id>` でも見る
- 目で確かめる: `node scripts/show_shots.mjs [id…]`（うごくえ=正解、ずっこけ=まちがい。ほかに `peekaboo` `michi-…`（4種×E=0/0.5/0.9・橋・どうくつ）`reach-…` `band-…`。`.smoke/shows/`）。`node scripts/contact_sheet.mjs 出力.png [--w 幅 --from 割合 --top 割合] 画像…` で1枚に並べて見る
- 新しいうごくえ・ずっこけは、1秒に3回以上光らせない・痛い／こわい表現にしない
- **みちのり**（`components/Road.tsx`、演出 `michi:jungle|umi|okashi|uchu`、`shows/michi.ts`）: クイズの上の道。せいかい数 ÷ クリア数 = E で おさる（`getCurrent().char`）が歩き、空は `skyStage(E)`（朝 <0.25 / 昼 <0.55 / 夕焼け <0.85 / 夜）。1/3 に川と橋（通ると ゆれる）、2/3 にどうくつ（「やっほー」2回）。夜はホタル・流れ星。見た目は theme で切りかえ、`play` は何もしない。動きの強さ 0 は 跳ねない・ホタル/流れ星/泡なし（`.road.still`）
- **リーチ**（`shows/reach.ts` の `reachFor(のこり)`）: のこり3問で「あと3もん！」＋ドラムロール＋BGM半音上げ＋画面下のふちにおさる3〜5匹（`.reach-crowd`、ほっぺをふくらませて息を止める）、のこり1問で「ラスト！」＋絵1.06倍、クリアの正解で「ぷはーっ！」。お知らせは `shouldAnnounce` で1回だけ（`?goal=3` は最初に1回）。お知らせの読み上げは、ほかの読み上げと重ならないよう Quiz の流れの中（正解の読み上げのあと／最初の問題の前）に入れる
- **おさるバンド**（BGM）: 曲・楽器・テンポは `lib/bgm.ts`（純粋。`layersAt(E)` `bpmAt(E)` `SONGS`。旋律はオリジナル、楽譜は `'C5:2 E5 - Am:4'` の書式）、鳴らすのは `sound.ts` の `startBgm(song, E)` / `setBgmLevel(E)` / `setBgmKey(半音)` / `pauseBgm` / `resumeBgm` / `stopBgm` / `duckBgm`（先読みの予約。BGMは効果音の 0.4 倍の音量）。楽器は たいこ → ベース(E≥.2) → マリンバ(.4) → ラッパ(.6) → コーラス(.8)、テンポは 100→124 BPM。読み上げ中は `speech.ts` が BGM を半分に（`speak` の前後。重なっても全部終わるまで）。フィーバーに入ったら `pauseBgm`、終わったら `resumeBgm`、終了・クリア・画面を離れたら `stopBgm`。曲は演出 `ongaku:march|matsuri|omocha|komoriuta`。`components/Band.tsx` が、楽器が加わるたびに おさるを1匹ずつ足す
- みちのり・おんがくは 遊び始めに `chooseShow(cat, pick, 解放)` で選ぶ（`?show=<id>` で固定できる）。新しい曲・道は `bgm.ts` / `michi.ts`＋`ongaku.ts` に足して、`registry.test.ts` 系のテストも直す

## 演出の約束（子ども向けの安全）
- フラッシュは1回ずつ・ゆっくり消す（1秒に3回以上点滅させない）
- まちがえても罰はなし。「おしい！」＋正解を読み上げ、あとで再出題
- iOS は最初のタップで音と読み上げを有効化する（`unlockAudio` / `unlockSpeech`）

## 今後（計画）
- P3: 1000問分のSVGを描く（レベル1から、カテゴリごと）
- P4: ガチャ・おさる図鑑・ことば図鑑・親の録音読み上げ
- P5: PWA化（オフライン）、プレイ時間制限、保護者メニュー、公開（Cloudflare Pages など）
