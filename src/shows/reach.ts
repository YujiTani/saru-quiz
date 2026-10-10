// リーチ: クリアまでのこり3問・1問のときに何を出すか（純粋な関数）

export type Reach = {
  /** 画面のふちで息を止めて見ているおさるの数（0 なら出さない） */
  crowd: number
  /** その場でお知らせするもの（のこり3問・1問になったとき1回だけ） */
  announce?: { banner: string; speech: string; drumroll: boolean }
  /** BGM をあげる半音の数 */
  keyUp: number
  /** 問題の絵を少し大きく出す（ラスト） */
  bigPic: boolean
}

/** のこり問題数（クリアに必要な数 − せいかい数）から、出すものを決める。のこり0以下は クリアなので何も出さない */
export function reachFor(remaining: number): Reach {
  if (remaining <= 0 || remaining > 3) return { crowd: 0, keyUp: 0, bigPic: false }
  const crowd = remaining === 3 ? 3 : remaining === 2 ? 4 : 5
  if (remaining === 3) return { crowd, announce: { banner: 'あと3もん！', speech: 'あと、3もん！', drumroll: true }, keyUp: 1, bigPic: false }
  if (remaining === 1) return { crowd, announce: { banner: 'ラスト！', speech: 'ラスト！', drumroll: false }, keyUp: 1, bigPic: true }
  return { crowd, keyUp: 1, bigPic: false }
}

/**
 * お知らせを出すか。のこり3問・1問の「なった瞬間」に1回だけ（すでに出したものは出さない）。
 * ?goal=3 のように最初からのこり3問のときも、はじめの1回だけ
 */
export function shouldAnnounce(remaining: number, done: ReadonlySet<number>): boolean {
  return !!reachFor(remaining).announce && !done.has(remaining)
}
