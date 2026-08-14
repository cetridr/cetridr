import { createServer, type Server, type IncomingMessage } from 'node:http'
import { readFileSync } from 'node:fs'
import { authorized } from './auth.js'
import { validateProfile, saveConfig, type CetridrConfig, type ProfileConfig } from './config.js'
import { readLogTail } from './logger.js'
import type { Supervisor } from './supervisor.js'

const HTML = readFileSync(new URL('./cetridr.html', import.meta.url), 'utf8')

export type AttentionState = 'working' | 'idle' | 'blocked'
export interface AttentionRecord { state: AttentionState; detail?: string; at: number }

export interface CetridrServerOptions {
  host: string
  port: number
  token?: string
  config: CetridrConfig
  configPath: string
  logsDir?: string
}

export function createCetridrServer(supervisor: Supervisor, opts: CetridrServerOptions): Server {
  const { host, port, token, config, configPath, logsDir } = opts
  const attention = new Map<string, AttentionRecord>()

  return createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
    })
  })

  async function handle(req: IncomingMessage, res: import('node:http').ServerResponse): Promise<void> {
    const u = new URL(req.url ?? '/', 'http://localhost')
    const path = u.pathname

    if (req.method === 'GET' && path === '/') {
      return send(res, 200, HTML, 'text/html; charset=utf-8')
    }

    if (token && !authorized(req.headers, token)) {
      return sendJson(res, 401, { error: 'unauthorized' })
    }

    if (req.method === 'GET' && path === '/api/config') {
      return sendJson(res, 200, { cetridr: { host, port }, profiles: config.profiles })
    }

    if (req.method === 'GET' && path === '/api/status') {
      const profiles = supervisor.statusAll().map((s) => ({ ...s, attention: attention.get(s.id) ?? null }))
      return sendJson(res, 200, { profiles })
    }

    // Attention report from a reporter plugin running inside a DSH daemon.
    if (req.method === 'POST' && path === '/api/report') {
      const body = await readJson(req)
      if (typeof body.id === 'string' && (body.state === 'working' || body.state === 'idle' || body.state === 'blocked')) {
        attention.set(body.id, {
          state: body.state,
          detail: typeof body.detail === 'string' ? body.detail : undefined,
          at: Date.now(),
        })
        return sendJson(res, 200, { ok: true })
      }
      return sendJson(res, 400, { error: 'bad report: need {id, state}' })
    }

    // Profiles CRUD (persisted to configPath).
    if (req.method === 'POST' && path === '/api/profiles') {
      const p = validateProfile(await readJson(req), config.profiles.length)
      if (config.profiles.some((x) => x.id === p.id)) return sendJson(res, 409, { error: 'duplicate id: ' + p.id })
      config.profiles.push(p)
      saveConfig(config, configPath)
      return sendJson(res, 200, { profiles: config.profiles })
    }

    if (req.method === 'POST' && path === '/api/profiles/reorder') {
      const body = await readJson(req)
      if (!Array.isArray(body.ids)) return sendJson(res, 400, { error: 'ids array required' })
      const order = body.ids as string[]
      config.profiles.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
      saveConfig(config, configPath)
      return sendJson(res, 200, { profiles: config.profiles })
    }

    if (req.method === 'DELETE' && path.startsWith('/api/profiles/')) {
      const id = decodeURIComponent(path.slice('/api/profiles/'.length))
      const idx = config.profiles.findIndex((x) => x.id === id)
      if (idx === -1) return sendJson(res, 404, { error: 'no such profile: ' + id })
      supervisor.removeProfile(id)
      config.profiles.splice(idx, 1)
      saveConfig(config, configPath)
      return sendJson(res, 200, { profiles: config.profiles })
    }

    if (req.method === 'PATCH' && path.startsWith('/api/profiles/')) {
      const id = decodeURIComponent(path.slice('/api/profiles/'.length))
      const p = config.profiles.find((x) => x.id === id)
      if (!p) return sendJson(res, 404, { error: 'no such profile: ' + id })
      const body = await readJson(req)
      if (typeof body.label === 'string') p.label = body.label
      if (typeof body.emoji === 'string') p.emoji = body.emoji
      saveConfig(config, configPath)
      return sendJson(res, 200, { profiles: config.profiles })
    }

    // Per-profile log tail.
    if (req.method === 'GET' && path.startsWith('/api/logs/')) {
      const id = decodeURIComponent(path.slice('/api/logs/'.length))
      const tail = Number(u.searchParams.get('tail') || 500)
      if (!logsDir) return sendJson(res, 404, { error: 'logs disabled' })
      return sendJson(res, 200, { id, text: readLogTail(logsDir, id, tail) })
    }

    const action = matchAction(req.method, path)
    if (action) {
      const changed = supervisor[action.verb](action.id)
      return sendJson(res, 200, { profiles: supervisor.statusAll(), changed })
    }

    return sendJson(res, 404, { error: 'not found' })
  }
}

function matchAction(method: string | undefined, path: string): { verb: 'start' | 'stop' | 'restart'; id: string } | null {
  const m = path.match(/^\/api\/(start|stop|restart)\/([A-Za-z0-9_-]+)$/)
  if (!m || method !== 'POST') return null
  return { verb: m[1] as 'start' | 'stop' | 'restart', id: m[2] }
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 1e6) { reject(new Error('body too large')); req.destroy() }
    })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch { reject(new Error('invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

function send(res: import('node:http').ServerResponse, code: number, body: string, type: string): void {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

function sendJson(res: import('node:http').ServerResponse, code: number, obj: unknown): void {
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8')
}
