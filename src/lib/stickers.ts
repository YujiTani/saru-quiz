// シール: その日はじめて遊び終わったら1枚。7種類を順番に配る。休んでも続きから（やり直さない）
// どうぶつの絵の id（questions.json にある。public/illust/<id>.svg）
export const STICKER_IDS = ['cat', 'dog', 'rabbit', 'elephant', 'giraffe', 'giant-panda', 'lion'] as const
export const STICKER_KINDS = STICKER_IDS.length

/** n 枚目（1から）にもらうシールの種類 0〜6 */
export const stickerKind = (count: number): number => (((count - 1) % STICKER_KINDS) + STICKER_KINDS) % STICKER_KINDS

/** 7枚そろった（7の倍数）か */
export const stickerComplete = (count: number): boolean => count > 0 && count % STICKER_KINDS === 0

/** 今のセットで何枚そろったか（0〜7。7枚そろった直後は 7） */
export const stickerInSet = (count: number): number => (count === 0 ? 0 : ((count - 1) % STICKER_KINDS) + 1)

/** シールの絵のパス */
export const stickerImg = (kind: number): string => `illust/${STICKER_IDS[kind]}.svg`
