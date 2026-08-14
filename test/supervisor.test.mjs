import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { validateConfig } from '../lib/config.js'
import { Supervisor } from '../lib/supervisor.js'

const fake = join(import.meta.dirname, 'fake-target.mjs')

function waitFor(sup, id, predicate, timeoutMs = 5000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const s = sup.status(id)
      if (predicate(s)) return resolve(s)
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout: ' + id + ' status=' + s.status))
      setTimeout(tick, 50)
    }
    tick()
  })
}

test('spawns a fake target, reaches running, then stops cleanly', async () => {
  const config = validateConfig({
    spawnAll: false,
    restart: false,
    profiles: [{ id: 't', port: 3096, command: ['node', fake, '{port}', 'test'] }],
  })
  const sup = new Supervisor(config)
  sup.spawn('t')
  sup.start() // starts the health loop (spawnAll=false so it does not double-spawn)
  const running = await waitFor(sup, 't', (s) => s.status === 'running')
  assert.equal(running.reachable, true)
  sup.stop('t')
  const stopped = await waitFor(sup, 't', (s) => s.status === 'stopped')
  assert.equal(stopped.status, 'stopped')
})

test('auto-restarts a crashing child (backoff increments restarts)', async () => {
  const config = validateConfig({
    spawnAll: false,
    restart: true,
    restartBackoffMs: 40,
    profiles: [{ id: 'crash', port: 3097, command: ['node', '-e', 'process.exit(1)'] }],
  })
  const sup = new Supervisor(config)
  sup.spawn('crash')
  await new Promise((r) => setTimeout(r, 400))
  const s = sup.status('crash')
  assert.ok(s.restarts >= 1, 'expected restarts >= 1, got ' + s.restarts)
  sup.stopAll()
})
