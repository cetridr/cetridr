import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  validateConfig,
  defaultConfig,
  saveConfig,
  loadConfig,
  resolveProfileHome,
} from '../lib/config.js'

test('defaultConfig has loopback defaults and empty profiles', () => {
  const c = defaultConfig()
  assert.equal(c.host, '127.0.0.1')
  assert.equal(c.port, 4000)
  assert.equal(c.dshBin, 'dsh')
  assert.deepEqual(c.profiles, [])
})

test('validateConfig accepts and fills defaults', () => {
  const c = validateConfig({ profiles: [{ id: 'web', port: 3080 }] })
  assert.equal(c.host, '127.0.0.1')
  assert.equal(c.profiles[0].id, 'web')
  assert.equal(c.profiles[0].port, 3080)
})

test('validateConfig rejects missing profiles', () => {
  assert.throws(() => validateConfig({}), /profiles must be an array/)
})

test('validateConfig rejects out-of-range port', () => {
  assert.throws(() => validateConfig({ profiles: [{ id: 'x', port: 99999 }] }), /port/)
})

test('validateConfig rejects invalid id', () => {
  assert.throws(() => validateConfig({ profiles: [{ id: 'bad id', port: 1 }] }), /id/)
})

test('saveConfig/loadConfig round-trip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cetridr-'))
  const path = join(dir, 'config.json')
  saveConfig(validateConfig({ profiles: [{ id: 'web', port: 3080 }] }), path)
  const c = loadConfig(path)
  assert.equal(c.profiles[0].id, 'web')
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).profiles[0].port, 3080)
})

test('resolveProfileHome resolves relative under homesDir', () => {
  const env = { HOME: '/home/me', CETRIDR_HOME: '/tmp/p' }
  assert.equal(resolveProfileHome('web2', env), '/tmp/p/homes/web2')
  assert.equal(resolveProfileHome('~/abs', env), '/home/me/abs')
  assert.equal(resolveProfileHome('/abs', env), '/abs')
})
