import { pileHtml } from '../shows/banana'

/** バナナのやま（段階 0〜6）の絵。size は一辺（px） */
export function BananaPile({ stage, size = 160, className = '' }: { stage: number; size?: number; className?: string }) {
  return <span className={`pile-wrap ${className}`} aria-hidden dangerouslySetInnerHTML={{ __html: pileHtml(stage, size) }} />
}
