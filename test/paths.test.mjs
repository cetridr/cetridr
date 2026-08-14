import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cetridrHome, configPath, homesDir, expandHome } from '../lib/paths.js'

test('cetridrHome defaults to ~/.cetridr', () => {
  assert.equal(cetridrHome({ HOME: '/home/me' }), '/home/me/.cetridr')
})

test('cetridrHome respects CETRIDR_HOME', () => {
  assert.equal(cetridrHome({ HOME: '/home/me', CETRIDR_HOME: '/tmp/cetridr' }), '/tmp/cetridr')
})

test('cetridrHome expands ~ in override', () => {
  assert.equal(cetridrHome({ HOME: '/home/me', CETRIDR_HOME: '~/my-cetridr' }), '/home/me/my-cetridr')
})

test('expandHome handles ~ and relative', () => {
  assert.equal(expandHome('~', { HOME: '/home/me' }), '/home/me')
  assert.equal(expandHome('~/x', { HOME: '/home/me' }), '/home/me/x')
})

test('configPath and homesDir live under cetridrHome', () => {
  const env = { HOME: '/home/me', CETRIDR_HOME: '/tmp/p' }
  assert.equal(configPath(env), '/tmp/p/config.json')
  assert.equal(homesDir(env), '/tmp/p/homes')
})
