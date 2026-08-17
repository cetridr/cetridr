#!/usr/bin/env node
// Bump the Homebrew formula's url + sha256 for a new cetridr release.
//
// usage: node scripts/bump-formula.mjs <version> <formula-path>
//
// Source of truth is the tarball the publish job uploaded to the GitHub
// Release as an asset. GitHub computes an sha256 digest for every release
// asset and exposes it via `gh release view --json assets` (the "digest"
// field, prefixed "sha256:"). We read that digest instead of downloading
// anything, so there is no npm-CDN lag and no non-reproducible local re-pack.
// This is the same pattern goreleaser and the wider Homebrew-tap ecosystem
// use: hash the exact artifact you publish, and never a mirror.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const [version, formulaPath] = process.argv.slice(2)
if (!version || !formulaPath) {
  console.error('usage: node scripts/bump-formula.mjs <version> <formula-path>')
  process.exit(1)
}

const repo = process.env.CETRIDR_REPO ?? 'cetridr/cetridr'
const tag = 'v' + version

const { assetName, sha256 } = releaseAsset(repo, tag)
const url = 'https://github.com/' + repo + '/releases/download/' + tag + '/' + assetName

const formula = readFileSync(formulaPath, 'utf8')
const updated = formula
  .replace(/url "[^"]*"/, 'url "' + url + '"')
  .replace(/sha256 "[^"]*"/, 'sha256 "' + sha256 + '"')
writeFileSync(formulaPath, updated)

console.log('bumped formula to ' + version + ' sha256=' + sha256 + ' url=' + url)

function releaseAsset(repo, tag) {
  let json
  try {
    json = execFileSync(
      'gh',
      ['release', 'view', tag, '--repo', repo, '--json', 'assets'],
      { encoding: 'utf8' }
    )
  } catch (err) {
    throw new Error('gh release view ' + tag + ' failed: ' + err.message)
  }
  const { assets } = JSON.parse(json)
  const asset = assets.find((a) => a.name.endsWith('.tgz'))
  if (!asset) {
    throw new Error('release ' + tag + ' has no .tgz asset; upload it before bumping the formula')
  }
  const digest = asset.digest ?? ''
  if (!digest.startsWith('sha256:')) {
    throw new Error('asset ' + asset.name + ' has no sha256 digest (got "' + digest + '")')
  }
  return { assetName: asset.name, sha256: digest.slice('sha256:'.length) }
}
