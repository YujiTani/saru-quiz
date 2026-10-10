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
- のこり5秒からは時間の進みが半分（5→0 を10秒かけて大きくカウントダウン）。`Quiz.tsx` の `COUNTDOWN_MS`

## 確認手順（変更したら必ず）
- イラスト追加後: `node scripts/fit_illust.mjs <id…>`（描いた範囲を測って中央・同じ大きさにそろえる。何度実行しても同じ）→ `node scripts/sheet.mjs <カテゴリ名>` → `.sheets/*.png` を目視確認（構文チェック込み）
- コード変更後: `npm run check`（問題JSON再生成 + 単体テスト + 型チェック + iPhoneサイズの通しテスト。スクショは `.smoke/`）
- 単体テスト: `npm run test`（vitest。`src/**/*.test.ts`。進捗・ライトナー式の箱・乱数・日付・演出の解放と選び方。設定は `vitest.config.ts`）
- テスト用のURLパラメータ（`src/lib/testflags.ts`）
  - `?seed=数値` 乱数を固定（`src/lib/rng.ts`。`Math.random` のかわりに `rng()` を使う）
  - `?show=<id>` `?demo` 保存もランキングへの送信もしない
  - `?cat=カテゴリ名` そのカテゴリだけ出題（保存もランキングもなし）
  - `?time=秒` `?goal=問題数` は今までどおり（これらは記録する）
- 進捗の更新は `src/lib/progress.ts` の `applyResult`（純粋）。単語の箱（☆・くもり）は `src/lib/leitner.ts`。日付は `src/lib/day.ts`（テストでは `setNow`）
- ヘッドレスChromeは `~/.cache/saru-quiz/` にある（`scripts/browser.mjs`）

## 演出エンジン（`src/shows/`）
- 演出1つ = `Show`（`types.ts`）。`registry.ts` の `SHOWS` に登録し、`base: true` か `unlock(u)` で手に入れる。解放の集計は `unlock.ts` の `unlockCtx(save, now)`
- 選び方: `pickShow(cat, save.shows.pick, u, rng, avoid)`（固定 / おまかせ / 直前を避ける）、うごくえは `ugokuFor(カテゴリ名, u)`。`?show=<id>` はそのカテゴリの演出を必ずその id にする（`index.ts` の `chooseUgoku` / `chooseZukkoke`）
- 再生は `play(show, makeCtx({...}))`。DOM のアニメは `ctx.layer`（`layer.ts`。`#show-layer`、z-index 25）に置き、`layer.go(el, keyframes, opts)`（Web Animations）で動かす。`clear()` で片づけ、次の問題に入る前に Quiz が呼ぶ。clear 後は古い演出が何も置けない
- 動きの強さ（設定 0〜1）は `effects.setMotion`。0 のときは粒子が最大4個・画面ゆれとフラッシュなしで、`layer.go` が「ふわっと光って消えるだけ」にする。1つ増やしたら `MOTION=0 node scripts/show_shots.mjs <id>` でも見る
- 目で確かめる: `node scripts/show_shots.mjs [id…]`（うごくえ=正解、ずっこけ=まちがい。`.smoke/shows/`）
- 新しいうごくえ・ずっこけは、1秒に3回以上光らせない・痛い／こわい表現にしない

## 演出の約束（子ども向けの安全）
- フラッシュは1回ずつ・ゆっくり消す（1秒に3回以上点滅させない）
- まちがえても罰はなし。「おしい！」＋正解を読み上げ、あとで再出題
- iOS は最初のタップで音と読み上げを有効化する（`unlockAudio` / `unlockSpeech`）

## 今後（計画）
- P3: 1000問分のSVGを描く（レベル1から、カテゴリごと）
- P4: ガチャ・おさる図鑑・ことば図鑑・親の録音読み上げ
- P5: PWA化（オフライン）、プレイ時間制限、保護者メニュー、公開（Cloudflare Pages など）
