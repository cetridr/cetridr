import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Root of all cetridr state: config, isolated homes, logs.
 *  Defaults to ~/.cetridr (a sibling of DSH's own ~/.dsh); override with
 *  the CETRIDR_HOME environment variable. */
export function cetridrHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CETRIDR_HOME
  if (override) return expandHome(override, env)
  const home = env.HOME || homedir()
  return join(home, '.cetridr')
}

/** Expand a leading ~ (or ~/) and resolve relative paths against cwd. */
export function expandHome(p: string, env: NodeJS.ProcessEnv = process.env): string {
  const home = env.HOME || homedir()
  if (p === '~') return home
  if (p.startsWith('~/')) return join(home, p.slice(2))
  return resolve(p)
}

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(cetridrHome(env), 'config.json')
}

export function homesDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(cetridrHome(env), 'homes')
}

export function logsDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(cetridrHome(env), 'logs')
}
