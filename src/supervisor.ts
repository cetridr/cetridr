import { spawn, type ChildProcess } from 'node:child_process'
import { resolveProfileHome, type CetridrConfig, type ProfileConfig } from './config.js'
import { FileLogger } from './logger.js'

const HEALTH_TIMEOUT_MS = 1500
const HEALTH_INTERVAL_MS = 2000
const MAX_RESTARTS = 10
const MAX_BACKOFF_MS = 30000

export type ProfileStatus = 'running' | 'starting' | 'stopped' | 'error'

export interface ProfileRuntime {
  id: string
  label?: string
  emoji?: string
  port: number
  url: string
  pid: number | null
  status: ProfileStatus
  reachable: boolean
  exitCode: number | null
  signal?: string | null
  restarts: number
}

export interface SupervisorOptions {
  logsDir?: string
  /** Injected as CETRIDR_URL so a reporter plugin can POST status back. */
  cetridrUrl?: string
  /** Injected as CETRIDR_TOKEN for the reporter's x-cetridr-token. */
  token?: string
  onchange?: (id: string, status: ProfileRuntime) => void
}

export class Supervisor {
  #profiles: ProfileConfig[]
  #dshBin: string
  #spawnAll: boolean
  #restart: boolean
  #restartBackoffMs: number
  #logsDir?: string
  #cetridrUrl?: string
  #token?: string
  #onchange: (id: string, status: ProfileRuntime) => void
  #children = new Map<string, ChildProcess>()
  #loggers = new Map<string, FileLogger>()
  #reachable = new Map<string, boolean>()
  #exit = new Map<string, { code: number | null; signal: string | null }>()
  #stopping = new Set<string>()
  #restartCount = new Map<string, number>()
  #restartTimers = new Map<string, NodeJS.Timeout>()
  #timer: NodeJS.Timeout | null = null

  constructor(config: CetridrConfig, opts: SupervisorOptions = {}) {
    this.#profiles = config.profiles
    this.#dshBin = config.dshBin ?? 'dsh'
    this.#spawnAll = config.spawnAll !== false
    this.#restart = config.restart !== false
    this.#restartBackoffMs = config.restartBackoffMs ?? 1000
    this.#logsDir = opts.logsDir
    this.#cetridrUrl = opts.cetridrUrl
    this.#token = opts.token
    this.#onchange = opts.onchange ?? (() => {})
  }

  get profiles(): ProfileConfig[] { return this.#profiles }

  #isAlive(id: string): boolean {
    const c = this.#children.get(id)
    return !!c && !this.#exit.has(id)
  }

  start(): void {
    if (this.#spawnAll) for (const p of this.#profiles) this.spawn(p.id)
    void this.#healthLoop()
    this.#timer = setInterval(() => void this.#healthLoop(), HEALTH_INTERVAL_MS)
    this.#timer.unref?.()
  }

  buildCommand(p: ProfileConfig): string[] {
    if (p.command && p.command.length) {
      return p.command.map((a) => a.replaceAll('{port}', String(p.port)).replaceAll('{id}', p.id))
    }
    return [this.#dshBin, '--profile', p.id, '--port', String(p.port)]
  }

  spawn(id: string): ProfileRuntime {
    const p = this.#profiles.find((x) => x.id === id)
    if (!p) throw new Error('unknown profile: ' + id)
    if (p.external) return this.status(id)
    if (this.#isAlive(id)) return this.status(id)
    this.#doSpawn(id)
    return this.status(id)
  }

  #doSpawn(id: string): void {
    const p = this.#profiles.find((x) => x.id === id)!
    const cmd = this.buildCommand(p)
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CETRIDR_ID: id,
      CETRIDR_PORT: String(p.port),
    }
    if (p.home) env.DSH_HOME = resolveProfileHome(p.home)!
    if (this.#cetridrUrl) env.CETRIDR_URL = this.#cetridrUrl
    if (this.#token) env.CETRIDR_TOKEN = this.#token

    if (this.#logsDir) this.#loggers.set(id, new FileLogger(this.#logsDir, id))

    const child = spawn(cmd[0], cmd.slice(1), { stdio: ['ignore', 'pipe', 'pipe'], env })
    this.#children.set(id, child)
    this.#reachable.set(id, false)
    this.#exit.delete(id)

    const pipe = (d: Buffer) => {
      const line = d.toString().trim()
      if (!line) return
      console.log('[' + id + '] ' + line)
      this.#loggers.get(id)?.log(line)
    }
    child.stdout.on('data', pipe)
    child.stderr.on('data', pipe)
    child.on('error', (err) => {
      console.error('[' + id + '] spawn error: ' + err.message)
      this.#loggers.get(id)?.log('spawn error: ' + err.message)
    })
    child.on('exit', (code, signal) => {
      this.#exit.set(id, { code, signal })
      this.#reachable.set(id, false)
      this.#loggers.get(id)?.close()
      this.#loggers.delete(id)
      const deliberate = this.#stopping.delete(id)
      this.#onchange(id, this.status(id))
      if (!deliberate && !p.external && this.#restart) this.#scheduleRestart(id)
    })

    this.#onchange(id, this.status(id))
  }

  #scheduleRestart(id: string): void {
    const count = this.#restartCount.get(id) ?? 0
    if (count >= MAX_RESTARTS) return
    this.#restartCount.set(id, count + 1)
    const delay = Math.min(this.#restartBackoffMs * Math.pow(2, count), MAX_BACKOFF_MS)
    const t = setTimeout(() => {
      this.#restartTimers.delete(id)
      if (!this.#isAlive(id) && !this.#stopping.has(id)) this.#doSpawn(id)
    }, delay)
    t.unref?.()
    this.#restartTimers.set(id, t)
    this.#onchange(id, this.status(id))
  }

  #cancelRestart(id: string): void {
    const t = this.#restartTimers.get(id)
    if (t) { clearTimeout(t); this.#restartTimers.delete(id) }
  }

  stop(id: string): ProfileRuntime {
    const child = this.#children.get(id)
    this.#cancelRestart(id)
    if (!child || !this.#isAlive(id)) return this.status(id)
    this.#stopping.add(id)
    this.#restartCount.set(id, 0)
    child.kill('SIGTERM')
    setTimeout(() => {
      if (this.#isAlive(id) && this.#children.get(id) === child) child.kill('SIGKILL')
    }, 3000).unref?.()
    return this.status(id)
  }

  restart(id: string): ProfileRuntime {
    const wasAlive = this.#isAlive(id)
    this.stop(id)
    if (wasAlive) {
      this.#children.get(id)!.once('exit', () => this.spawn(id))
    } else {
      this.spawn(id)
    }
    return this.status(id)
  }

  removeProfile(id: string): void {
    this.stop(id)
    this.#children.delete(id)
    this.#reachable.delete(id)
    this.#exit.delete(id)
    this.#restartCount.delete(id)
    this.#stopping.delete(id)
  }

  stopAll(): void {
    for (const id of this.#children.keys()) this.stop(id)
    for (const l of this.#loggers.values()) l.close()
    this.#loggers.clear()
  }

  status(id: string): ProfileRuntime {
    const p = this.#profiles.find((x) => x.id === id)!
    const child = this.#children.get(id)
    const url = 'http://127.0.0.1:' + p.port
    const base: ProfileRuntime = {
      id, label: p.label, emoji: p.emoji, port: p.port, url,
      pid: child?.pid ?? null, status: 'stopped', reachable: false,
      exitCode: null, restarts: this.#restartCount.get(id) ?? 0,
    }

    if (p.external) {
      const up = !!this.#reachable.get(id)
      return { ...base, status: up ? 'running' : 'stopped', reachable: up }
    }
    if (!child) return base
    const ex = this.#exit.get(id)
    if (ex) {
      const clean = ex.code === 0 || ex.signal === 'SIGTERM' || ex.signal === 'SIGKILL' || ex.signal === 'SIGINT'
      return { ...base, status: clean ? 'stopped' : 'error', exitCode: ex.code, signal: ex.signal }
    }
    if (this.#reachable.get(id)) return { ...base, status: 'running', reachable: true }
    return { ...base, status: 'starting' }
  }

  statusAll(): ProfileRuntime[] {
    return this.#profiles.map((p) => this.status(p.id))
  }

  async #healthLoop(): Promise<void> {
    await Promise.all(this.#profiles.map(async (p) => {
      if (!p.external && !this.#isAlive(p.id)) return
      const was = this.#reachable.get(p.id)
      const now = await probe('http://127.0.0.1:' + p.port + '/')
      this.#reachable.set(p.id, now)
      if (now && was !== true) this.#restartCount.set(p.id, 0)
      if (was !== now) this.#onchange(p.id, this.status(p.id))
    }))
  }
}

async function probe(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), HEALTH_TIMEOUT_MS)
    const res = await fetch(url, { signal: ctl.signal })
    clearTimeout(t)
    return res.ok || res.status < 500
  } catch {
    return false
  }
}
