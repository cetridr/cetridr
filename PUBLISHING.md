# Publishing

This repo publishes two npm packages, versioned together (bump both `package.json` files to the
same version):

- `@cetridr/cetridr` — repo root (the Cetridr CLI).
- `dsh-whale-rider` — `packages/whale-rider/` (the DSH reporter plugin).

## One-time setup

npm only lets you configure a [Trusted Publisher](https://docs.npmjs.com/trusted-publishers) for a
package that already exists. So **each** package needs a one-time **manual publish** first.

### 1. Manual first publish

Run from the repo root with your npm token available. If your global `~/.npmrc` points `registry`
at a mirror (e.g. npmmirror), force npmjs.org with `--registry` — mirrors are read-only and reject
publishes.

```bash
pnpm run build
pnpm publish --registry https://registry.npmjs.org --access public

pnpm --filter dsh-whale-rider run build
pnpm --filter dsh-whale-rider publish --registry https://registry.npmjs.org --access public
```

### 2. Configure a Trusted Publisher (per package)

On npmjs.com, for **each** package → **Settings → Publishing Access → Trusted publishers →
Add a trusted publisher → GitHub Actions**:

| Field | Value |
| --- | --- |
| Organization or user | `cetridr` |
| Repository | `cetridr` |
| Workflow filename | `.github/workflows/publish.yml` |
| Allowed actions | `npm publish` |
| Environment | (leave empty) |

Recommended: enable **Require two-factor authentication and disallow tokens**.

## Publishing a release

After the one-time setup, publishing is fully automated:

```bash
# 1. bump both package.json versions to the same number (e.g. 0.2.1)
# 2. commit + push
git add -A && git commit -m "chore: v0.2.1"
git push origin main
# 3. create the GitHub Release (this also creates the tag and triggers the workflow)
gh release create v0.2.1 --generate-notes
```

Publishing the Release triggers `.github/workflows/publish.yml`, which checks out `main`, installs,
builds, tests, and publishes both packages via OIDC trusted publishing — no token, with provenance —
then bumps the Homebrew formula.

## How the Homebrew formula sha256 is derived

Homebrew hashes the exact file at the formula's `url`, so the digest must match the bytes a
user actually downloads. The npm registry tarball is a bad source of truth here: it lives behind a
CDN that can lag right after publish, and npm exposes no SHA-256 in its metadata (only SHA-1
`dist.shasum` and a SHA-512 SRI `dist.integrity`), so the only way to get the digest is to
download it — the "download and retry" trap. Locally re-packing (`npm pack` / `pnpm pack`) is
also not reproducible: the gzip output depends on the packer and Node version.

Instead, Cetridr follows the community-standard pattern (goreleaser, cargo-dist, and most
homebrew-tap CLIs): publish the exact artifact and hash *that*, never a mirror.

1. The `publish` job runs `pnpm pack` and uploads the tarball to the GitHub Release as an
   asset via `gh release upload`.
2. GitHub computes a SHA-256 digest for every release asset and returns it from
   `gh release view --json assets` (the `digest` field, prefixed `sha256:`).
3. The `update-formula` job runs `scripts/bump-formula.mjs`, which reads that digest from the
   release metadata and writes the formula's `url` (pointing at the GitHub Release asset) and
   `sha256`. No network fetch, no retry, no CDN, no re-pack drift.

The formula therefore downloads the same tarball GitHub already hashed, so the digest always
matches.

## Note: scoped-package alternative

If `@cetridr` is an npm **organization** you own (not just a user), you can add the Trusted Publisher
at the **org level** instead, which also covers brand-new packages in the scope. `dsh-whale-rider` is
unscoped, so its first publish is manual regardless.
