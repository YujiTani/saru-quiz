import { spriteUrl, type CharId, type Mood } from '../sprites/monkeys'

type Props = { char?: CharId; mood?: Mood; size?: number; anim?: 'idle' | 'jump' | 'dance' | 'fall' | 'slip' | 'none'; className?: string; style?: React.CSSProperties }

export function PixelMonkey({ char = 'monchan', mood = 'normal', size = 96, anim = 'idle', className = '', style }: Props) {
  return (
    <img
      src={spriteUrl(char, mood)}
      alt=""
      draggable={false}
      className={`pixel monkey anim-${anim} ${className}`}
      style={{ width: size, height: 'auto', ...style }}
    />
  )
}
