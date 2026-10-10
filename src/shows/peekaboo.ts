// いないいない…ばあ！ 正解の絵が、おさるの後ろから大きくなりながら出てくる
import type { ShowCtx } from './types'
import { bubbleText, centerOf, ease, hostRect, track, wait, withClone } from './util'

export async function peekaboo(ctx: ShowCtx): Promise<void> {
  const host = ctx.host
  // おさるを絵より手前に出して、絵が「おさるの後ろから」出るように見せる
  if (host) {
    host.classList.add('host-front')
    ctx.layer.defer(() => host.classList.remove('host-front'))
  }
  const h = hostRect(ctx)
  await withClone(ctx, async (c, from) => {
    const me = centerOf(from)
    const dx = h.left + h.width / 2 - me.x
    const dy = h.top + h.height / 2 - me.y
    c.style.opacity = '0'
    await bubbleText(ctx, 'いない いない…', h.left + h.width + 56, h.top - 6, 650)
    void bubbleText(ctx, 'ばあ！', h.left + h.width + 40, h.top - 6, 900)
    await ctx.layer.go(
      c,
      track(30, (t) => {
        const k = ease(t) * (1 + 0.1 * Math.sin(t * Math.PI)) // すこし行きすぎてから落ちつく
        return { x: dx * (1 - k), y: dy * (1 - k), s: 0.12 + 0.88 * k, o: Math.min(1, t * 6) }
      }),
      { duration: 800, easing: 'linear', fill: 'forwards' },
    )
    await wait(200)
  })
  host?.classList.remove('host-front')
}
