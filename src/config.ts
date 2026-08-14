import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { configPath, expandHome, homesDir } from './paths.js'

export interface ProfileConfig {
  id: string
  label?: string
  emoji?: string
  port: number
  /** DSH_HOME for this profile: '~...' / absolute, or relative to <cetridrHome>/homes. */
  home?: string
  /** true = don't spawn, just embed the already-running URL. */
  external?: boolean
  /** Fully replaces the default dsh invocation; {port}/{id} are substituted. */
  command?: string[]
}

export interface CetridrConfig {
  host: string
  port: number
  dshBin: string
  spawnAll: boolean
  /** Auto-restart a crashed child with exponential backoff. */
  restart: boolean
  /** Base backoff ms for the first restart (doubles each attempt, capped at 30s). */
  restartBackoffMs: number
  profiles: ProfileConfig[]
}

export function defaultConfig(): CetridrConfig {
  return { host: '127.0.0.1', port: 4000, dshBin: 'dsh', spawnAll: true, restart: true, restartBackoffMs: 1000, profiles: [] }
}

export function validateConfig(input: unknown): CetridrConfig {
  if (typeof input !== 'object' || input === null) throw new Error('config must be an object')
  const c = input as Record<string, unknown>
  const out: CetridrConfig = defaultConfig()
  if (typeof c.host === 'string') out.host = c.host
  if (typeof c.port === 'number') out.port = c.port
  if (typeof c.dshBin === 'string') out.dshBin = c.dshBin
  if (typeof c.spawnAll === 'boolean') out.spawnAll = c.spawnAll
  if (typeof c.restart === 'boolean') out.restart = c.restart
  if (typeof c.restartBackoffMs === 'number') out.restartBackoffMs = c.restartBackoffMs
  if (!Array.isArray(c.profiles)) throw new Error('config.profiles must be an array')
  out.profiles = c.profiles.map((p, i) => validateProfile(p, i))
  return out
}

export function validateProfile(p: unknown, i = 0): ProfileConfig {
  if (typeof p !== 'object' || p === null) throw new Error('profiles[' + i + '] must be an object')
  const r = p as Record<string, unknown>
  if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(r.id)) {
    throw new Error('profiles[' + i + '].id must be a string of [A-Za-z0-9_-]')
  }
  if (typeof r.port !== 'number' || !Number.isInteger(r.port) || r.port < 1 || r.port > 65535) {
    throw new Error('profiles[' + i + '].port must be an integer 1-65535')
  }
  const out: ProfileConfig = { id: r.id, port: r.port }
  if (typeof r.label === 'string') out.label = r.label
  if (typeof r.emoji === 'string') out.emoji = r.emoji
  if (typeof r.home === 'string') out.home = r.home
  if (typeof r.external === 'boolean') out.external = r.external
  if (Array.isArray(r.command) && r.command.every((x) => typeof x === 'string')) {
    out.command = r.command as string[]
  }
  return out
}

export function loadConfig(path: string = configPath()): CetridrConfig {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return defaultConfig()
  }
  return validateConfig(JSON.parse(raw))
}

export function saveConfig(config: CetridrConfig, path: string = configPath()): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
}

/** Resolve a profile's home to an absolute path (relative homes live under homesDir). */
export function resolveProfileHome(home: string | undefined, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!home) return undefined
  if (home.startsWith('~') || home.startsWith('/')) return expandHome(home, env)
  return resolve(homesDir(env), home)
}
