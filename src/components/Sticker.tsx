import { stickerImg } from '../lib/stickers'

/** まるいシール（どうぶつの絵）。kind は 0〜6、size は直径（px） */
export function Sticker({ kind, size = 48, className = '' }: { kind: number; size?: number; className?: string }) {
  return (
    <span className={`sticker ${className}`} style={{ width: size, height: size }}>
      <img src={stickerImg(kind)} alt="" draggable={false} />
    </span>
  )
}
