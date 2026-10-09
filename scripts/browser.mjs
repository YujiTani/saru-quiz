// ヘッドレスChromeの起動（スモークテスト・一覧画像で共通）
import puppeteer from 'puppeteer-core'
import fs from 'fs'
import os from 'os'
import path from 'path'

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const root = path.join(os.homedir(), '.cache/saru-quiz/chrome-headless-shell')
  const found = fs.existsSync(root) && fs.readdirSync(root, { recursive: true }).find((p) => String(p).endsWith('/chrome-headless-shell'))
  if (found) return path.join(root, String(found))
  throw new Error('ヘッドレスChromeがありません: npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/saru-quiz')
}

export const launch = () => puppeteer.launch({ executablePath: findChrome(), args: ['--autoplay-policy=no-user-gesture-required'] })
