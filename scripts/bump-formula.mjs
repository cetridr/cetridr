#!/usr/bin/env node
// Bump the Homebrew formula's url + sha256 for a new cetridr release.
// usage: node scripts/bump-formula.mjs <version> <formula-path> [sha256]
//
// When [sha256] is provided (computed by the publish job from the same tarball
// it uploads), it is used directly — no network fetch. Otherwise the script
// downloads the published tarball, retrying because the registry CDN can lag.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [version, formulaPath, providedSha256] = process.argv.slice(2)
if (!version || !formulaPath) {
  console.error('usage: node scripts/bump-formula.mjs <version> <formula-path> [sha256]')
  process.exit(1)
}

const tarball = 'https://registry.npmjs.org/@cetridr/cetridr/-/cetridr-' + version + '.tgz'
const sha256 = providedSha256 || await downloadSha256(tarball)

const formula = readFileSync(formulaPath, 'utf8')
const updated = formula
  .replace(/url "[^"]*"/, 'url "' + tarball + '"')
  .replace(/sha256 "[^"]*"/, 'sha256 "' + sha256 + '"')
writeFileSync(formulaPath, updated)

console.log('bumped formula to ' + version + ' sha256=' + sha256)

async function downloadSha256(url) {
  for (let i = 0; i < 12; i++) {
    const res = await fetch(url)
    if (res.ok) {
      return createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex')
    }
    if (res.status === 404 && i < 11) {
      await new Promise((r) => setTimeout(r, 5000))
      continue
    }
    throw new Error('tarball fetch failed: ' + res.status + ' ' + url)
  }
}
