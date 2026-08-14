#!/usr/bin/env node
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync,
  openSync, watchFile, statSync,
} from 'node:fs'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadConfig, saveConfig, defaultConfig,
  type CetridrConfig, type ProfileConfig,
} from './config.js'
import { configPath, cetridrHome, logsDir } from './paths.js'
import { loadOrCreateToken } from './auth.js'
import { Supervisor } from './supervisor.js'
import { createCetridrServer } from './server.js'

function printUsage(): void {
  console.log('cetridr — rule-them-all command center for DeepSeek Harness profiles')
  console.log('')
  console.log('Usage: cetridr <command> [options]')
  console.log('')
  console.log('Commands:')
  console.log('  init                         create the default config file')
  console.log('  start [--config <p>] [--daemon]   run the command center (foreground, or detach)')
  console.log('  stop                         stop a daemonized cetridr (via pidfile)')
  console.log('  list                         list configured profiles')
  console.log('  add <id> --port <n> [...]    add a profile (--label --emoji --home --external)')
  console.log('  rm <id>                      remove a profile')
  console.log('  status                       show runtime status of a running cetridr')
  console.log('  logs <id> [--follow]         print (and optionally tail) a profile log')
  console.log('  service                      print a launchd/systemd unit to run at login')
  console.log('')
  console.log('Config lives at ' + configPath() + ' (override with CETRIDR_HOME).')
}

function pidFile(): string {
  return join(cetridrHome(), 'cetridr.pid')
}

function cmdInit(): void {
  const p = configPath()
  if (existsSync(p)) { console.log('config already exists: ' + p); return }
  saveConfig(defaultConfig(), p)
  console.log('created ' + p)
}

function parseStartArgs(args: string[]): { configArg: string; daemon: boolean } {
  let configArg = configPath()
  let daemon = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) configArg = args[++i]
    else if (args[i] === '--daemon') daemon = true
  }
  return { configArg, daemon }
}

function cmdStart(args: string[]): void {
  const { configArg, daemon } = parseStartArgs(args)
  const cfg = loadConfig(configArg)
  const host = cfg.host || '127.0.0.1'
  const port = cfg.port || 4000
  const token = loadOrCreateToken(cetridrHome())

  if (daemon) {
    const pid = pidFile()
    if (existsSync(pid)) {
      const old = Number(readFileSync(pid, 'utf8').trim())
      try { process.kill(old, 0); console.log('already running (pid ' + old + ')'); return } catch {}
    }
    const outLog = join(logsDir(), 'cetridr.log')
    mkdirSync(dirname(outLog), { recursive: true })
    const out = openSync(outLog, 'a')
    const cliPath = fileURLToPath(new URL('./cli.js', import.meta.url))
    const child = spawn(process.execPath, [cliPath, 'start', '--config', configArg], {
      detached: true, stdio: ['ignore', out, out],
    })
    writeFileSync(pid, String(child.pid))
    child.unref()
    console.log('started (pid ' + child.pid + '), log: ' + outLog)
    console.log('URL: http://' + host + ':' + port + '/?t=' + token)
    return
  }

  const cetridrUrl = 'http://' + host + ':' + port
  const supervisor = new Supervisor(cfg, {
    logsDir: logsDir(),
    cetridrUrl,
    token,
    onchange: (id, status) => console.log('[cetridr] ' + id + ' -> ' + status.status),
  })
  const server = createCetridrServer(supervisor, { host, port, token, config: cfg, configPath: configArg, logsDir: logsDir() })
  server.listen(port, host, () => {
    console.log('Cetridr: http://' + host + ':' + port + '/?t=' + token)
    for (const p of cfg.profiles) {
      console.log('  ' + (p.emoji || '·') + ' ' + (p.label || p.id) + ' -> http://127.0.0.1:' + p.port)
    }
    supervisor.start()
  })

  const shutdown = () => {
    console.log('shutting down...')
    supervisor.stopAll()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref?.()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function cmdStop(): void {
  const pid = pidFile()
  if (!existsSync(pid)) { console.log('not running (no pidfile)'); return }
  const n = Number(readFileSync(pid, 'utf8').trim())
  try {
    process.kill(n, 'SIGTERM')
    console.log('sent SIGTERM to ' + n)
  } catch {
    console.log('process ' + n + ' not running')
  }
  try { unlinkSync(pid) } catch {}
}

function cmdList(): void {
  const cfg = loadConfig()
  if (!cfg.profiles.length) { console.log('no profiles (add with: cetridr add <id> --port <n>)'); return }
  for (const p of cfg.profiles) {
    const parts = [p.id, p.emoji || '·', p.label || '', 'port=' + p.port]
    if (p.external) parts.push('external')
    if (p.home) parts.push('home=' + p.home)
    console.log(parts.join('  '))
  }
}

function cmdAdd(args: string[]): void {
  const id = args[0]
  if (!id) throw new Error('usage: cetridr add <id> --port <n> [--label --emoji --home --external]')
  const opts: Record<string, string | boolean> = {}
  for (let i = 1; i < args.length; i++) {
    const a = args[i]
    if (a === '--external') { opts.external = true; continue }
    if (a.startsWith('--')) {
      const val = args[++i]
      if (val === undefined) throw new Error('missing value for ' + a)
      opts[a.slice(2)] = val
    } else {
      throw new Error('unexpected argument: ' + a)
    }
  }
  const port = Number(opts.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be an integer 1-65535')

  const cfg = loadConfig()
  if (cfg.profiles.some((p) => p.id === id)) throw new Error('profile already exists: ' + id)
  const entry: ProfileConfig = { id, port }
  if (typeof opts.label === 'string') entry.label = opts.label
  if (typeof opts.emoji === 'string') entry.emoji = opts.emoji
  if (typeof opts.home === 'string') entry.home = opts.home
  if (opts.external) entry.external = true
  cfg.profiles.push(entry)
  saveConfig(cfg)
  console.log('added ' + id + ' on port ' + port)
}

function cmdRm(args: string[]): void {
  const id = args[0]
  if (!id) throw new Error('usage: cetridr rm <id>')
  const cfg = loadConfig()
  const before = cfg.profiles.length
  cfg.profiles = cfg.profiles.filter((p) => p.id !== id)
  if (cfg.profiles.length === before) throw new Error('no such profile: ' + id)
  saveConfig(cfg)
  console.log('removed ' + id)
}

async function cmdStatus(): Promise<void> {
  const cfg: CetridrConfig = loadConfig()
  const token = loadOrCreateToken(cetridrHome())
  const url = 'http://' + (cfg.host || '127.0.0.1') + ':' + (cfg.port || 4000) + '/api/status'
  try {
    const res = await fetch(url, { headers: { 'x-cetridr-token': token } })
    if (res.status === 401) throw new Error('unauthorized (token mismatch)')
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const body = (await res.json()) as { profiles?: Array<{ id: string; status: string; port: number; restarts: number }> }
    for (const p of body.profiles ?? []) {
      console.log(p.id + '  ' + p.status + '  port ' + p.port + '  restarts ' + (p.restarts ?? 0))
    }
  } catch (err) {
    console.error('cetridr not running or unreachable: ' + (err instanceof Error ? err.message : String(err)))
    process.exit(1)
  }
}

function cmdLogs(args: string[]): void {
  const follow = args.includes('--follow') || args.includes('-f')
  const id = args.find((a) => !a.startsWith('-'))
  if (!id) throw new Error('usage: cetridr logs <id> [--follow]')
  const file = join(logsDir(), id + '.log')
  if (!existsSync(file)) { console.error('no log file for ' + id + ' (' + file + ')'); process.exit(1) }
  if (!follow) {
    process.stdout.write(readFileSync(file, 'utf8'))
    return
  }
  let printed = readFileSync(file, 'utf8')
  process.stdout.write(printed)
  watchFile(file, { interval: 250 }, () => {
    const cur = readFileSync(file, 'utf8')
    if (cur.length > printed.length) {
      process.stdout.write(cur.slice(printed.length))
      printed = cur
    }
  })
}

function cmdService(): void {
  const cliPath = fileURLToPath(new URL('./cli.js', import.meta.url))
  const home = cetridrHome()
  const cfg = configPath()
  const log = join(logsDir(), 'cetridr.log')
  const node = process.execPath

  if (process.platform === 'darwin') {
    console.log('# macOS launchd — 保存到 ~/Library/LaunchAgents/com.cetridr.plist，然后：')
    console.log('#   launchctl load ~/Library/LaunchAgents/com.cetridr.plist')
    console.log('<?xml version="1.0" encoding="UTF-8"?>')
    console.log('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">')
    console.log('<plist version="1.0"><dict>')
    console.log('  <key>Label</key><string>com.cetridr</string>')
    console.log('  <key>ProgramArguments</key><array>')
    console.log('    <string>' + node + '</string>')
    console.log('    <string>' + cliPath + '</string>')
    console.log('    <string>start</string>')
    console.log('    <string>--config</string>')
    console.log('    <string>' + cfg + '</string>')
    console.log('  </array>')
    console.log('  <key>EnvironmentVariables</key><dict><key>CETRIDR_HOME</key><string>' + home + '</string></dict>')
    console.log('  <key>RunAtLoad</key><true/>')
    console.log('  <key>KeepAlive</key><true/>')
    console.log('  <key>StandardOutPath</key><string>' + log + '</string>')
    console.log('  <key>StandardErrorPath</key><string>' + log + '</string>')
    console.log('</dict></plist>')
    return
  }

  console.log('# systemd user unit — 保存到 ~/.config/systemd/user/cetridr.service，然后：')
  console.log('#   systemctl --user daemon-reload && systemctl --user enable --now cetridr')
  console.log('[Unit]')
  console.log('Description=Cetridr')
  console.log('After=network.target')
  console.log('')
  console.log('[Service]')
  console.log('Type=simple')
  console.log('ExecStart=' + node + ' ' + cliPath + ' start --config ' + cfg)
  console.log('Environment=CETRIDR_HOME=' + home)
  console.log('Restart=on-failure')
  console.log('RestartSec=3')
  console.log('')
  console.log('[Install]')
  console.log('WantedBy=default.target')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const cmd = args[0]
  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printUsage(); return
    case 'init':
      cmdInit(); return
    case 'start':
      cmdStart(args.slice(1)); return
    case 'stop':
      cmdStop(); return
    case 'list':
      cmdList(); return
    case 'add':
      cmdAdd(args.slice(1)); return
    case 'rm':
      cmdRm(args.slice(1)); return
    case 'status':
      await cmdStatus(); return
    case 'logs':
      cmdLogs(args.slice(1)); return
    case 'service':
      cmdService(); return
    default:
      console.error('unknown command: ' + cmd)
      printUsage()
      process.exit(1)
  }
}

void main().catch((err: unknown) => {
  const m = err instanceof Error ? err.message : String(err)
  console.error(m)
  process.exit(1)
})
