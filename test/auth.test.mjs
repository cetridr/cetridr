import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrCreateToken, authorized, tokenFromUrl } from '../lib/auth.js'

test('loadOrCreateToken creates, persists, and returns the same token', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cetridr-auth-'))
  const t1 = loadOrCreateToken(dir)
  assert.match(t1, /^[0-9a-f]{48}$/)
  assert.ok(existsSync(join(dir, 'token')))
  assert.equal(loadOrCreateToken(dir), t1)
  assert.equal(readFileSync(join(dir, 'token'), 'utf8').trim(), t1)
})

test('authorized matches x-cetridr-token', () => {
  assert.equal(authorized({ 'x-cetridr-token': 'abc' }, 'abc'), true)
  assert.equal(authorized({ 'x-cetridr-token': 'abc' }, 'xyz'), false)
  assert.equal(authorized({}, 'abc'), false)
  assert.equal(authorized({ 'x-cetridr-token': ['abc'] }, 'abc'), true)
})

test('tokenFromUrl extracts t= query', () => {
  assert.equal(tokenFromUrl('http://127.0.0.1:4000/?t=abc123'), 'abc123')
  assert.equal(tokenFromUrl('http://127.0.0.1:4000/'), null)
})
