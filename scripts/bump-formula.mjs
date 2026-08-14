#!/usr/bin/env node
// Bump the Homebrew formula's url + sha256 for a new cetridr release.
// usage: node scripts/bump-formula.mjs <version> <formula-path>

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [version, formulaPath] = process.argv.slice(2)
if (!version || !formulaPath) {
  console.error('usage: node scripts/bump-formula.mjs <version> <formula-path>')
  process.exit(1)
}

const metaUrl = 'https://registry.npmjs.org/@cetridr/cetridr/' + version
const metaRes = await fetch(metaUrl)
if (!metaRes.ok) {
  console.error('npm metadata fetch failed: ' + metaRes.status + ' ' + metaUrl)
  process.exit(1)
}
const meta = await metaRes.json()
const tarball = meta.dist.tarball

const tarRes = await fetch(tarball)
if (!tarRes.ok) {
  console.error('tarball fetch failed: ' + tarRes.status + ' ' + tarball)
  process.exit(1)
}
const sha256 = createHash('sha256').update(Buffer.from(await tarRes.arrayBuffer())).digest('hex')

const formula = readFileSync(formulaPath, 'utf8')
const updated = formula
  .replace(/url "[^"]*"/, 'url "' + tarball + '"')
  .replace(/sha256 "[^"]*"/, 'sha256 "' + sha256 + '"')
writeFileSync(formulaPath, updated)

console.log('bumped formula to ' + version + ' sha256=' + sha256)
