import type { Context } from '@deepseek-ai/cordis'

export const name = 'whale-rider'

/** Host-side only: active when the cetridr supervisor injected these env vars. */
export const inject = ['agents']

function report(state: 'working' | 'idle' | 'blocked', detail?: string): void {
  const url = process.env.CETRIDR_URL
  const id = process.env.CETRIDR_ID
  if (!url || !id) return
  const token = process.env.CETRIDR_TOKEN || ''
  void fetch(url + '/api/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cetridr-token': token },
    body: JSON.stringify({ id, state, detail }),
  }).catch(() => {})
}

export function apply(ctx: Context): void {
  if (!process.env.CETRIDR_URL || !process.env.CETRIDR_ID) return

  const last = new Map<string, string>()

  const offStatus = ctx.on('agent/status' as any, (ev: any) => {
    const id = ev?.agent?.id as string | undefined
    const status = ev?.status as string | undefined
    if (!id || !status) return
    const prev = last.get(id)
    last.set(id, status)
    if (prev === status) return
    const running = Array.from(last.values()).some((s) => s === 'running')
    report(running ? 'working' : 'idle')
  })

  const offApproval = ctx.on('approval/request' as any, (req: any, next: () => any) => {
    report('blocked', typeof req?.toolName === 'string' ? req.toolName : undefined)
    return next()
  })

  ctx.effect(() => () => {
    offStatus()
    offApproval()
    last.clear()
  }, 'whale-rider: detach')
}
