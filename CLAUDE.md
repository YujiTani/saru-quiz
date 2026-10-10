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
- のこり5秒からは時間の進みが半分（5→0 を10秒かけて大きくカウントダウン）。`Quiz.tsx` の `COUNTDOWN_MS`

## 確認手順（変更したら必ず）
- イラスト追加後: `node scripts/fit_illust.mjs <id…>`（描いた範囲を測って中央・同じ大きさにそろえる。何度実行しても同じ）→ `node scripts/sheet.mjs <カテゴリ名>` → `.sheets/*.png` を目視確認（構文チェック込み）
- コード変更後: `npm run check`（問題JSON再生成 + 単体テスト + 型チェック + iPhoneサイズの通しテスト。スクショは `.smoke/`）
- 単体テスト: `npm run test`（vitest。`src/**/*.test.ts`。進捗・ライトナー式の箱・乱数・日付・演出の解放と選び方。設定は `vitest.config.ts`）
- テスト用のURLパラメータ（`src/lib/testflags.ts`）
  - `?seed=数値` 乱数を固定（`src/lib/rng.ts`。`Math.random` のかわりに `rng()` を使う）
  - `?show=<id>` `?demo` 保存もランキングへの送信もしない
  - `?cat=カテゴリ名` そのカテゴリだけ出題（保存もランキングもなし）
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
