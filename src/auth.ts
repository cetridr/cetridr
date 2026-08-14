import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'

/** Load the persisted cetridr token, or create a random one (0600). */
export function loadOrCreateToken(dir: string): string {
  const p = join(dir, 'token')
  try {
    const t = readFileSync(p, 'utf8').trim()
    if (t) return t
  } catch {
    // create below
  }
  const t = randomBytes(24).toString('hex')
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, t)
  chmodSync(p, 0o600)
  return t
}

/** Extract the t= query param from a URL. */
export function tokenFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get('t')
  } catch {
    return null
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Check an incoming headers object for a matching x-cetridr-token. */
export function authorized(headers: Record<string, unknown>, token: string): boolean {
  const h = headers['x-cetridr-token']
  const v = Array.isArray(h) ? h[0] : h
  return typeof v === 'string' && safeEqual(v, token)
}
