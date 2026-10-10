// おさるバンド: BGM に楽器が加わるたびに、楽器をもったおさるが画面のすみに1匹ずつ ぴょこんと出る
import { BGM_LAYERS, layersAt } from '../lib/bgm'
import type { CharId } from '../sprites/monkeys'
import { PixelMonkey } from './PixelMonkey'

const WHO: Record<string, CharId> = { drum: 'mandrill', bass: 'gorilla', marimba: 'sora', lead: 'orangutan', choir: 'mint' }

export function Band({ E, motion }: { E: number; motion: number }) {
  const on = layersAt(E)
  return (
    <div className="band" aria-hidden>
      {BGM_LAYERS.filter((l) => on.includes(l.id)).map((l, i) => (
        <div key={l.id} className={`band-mk ${motion > 0 ? 'pop' : ''}`} data-layer={l.id}>
          <PixelMonkey char={WHO[l.id]} mood="happy" size={24} anim={motion > 0 ? 'idle' : 'none'} style={{ animationDelay: `${i * 0.2}s` }} />
          <span className="band-emoji">{l.icon}</span>
        </div>
      ))}
    </div>
  )
}
