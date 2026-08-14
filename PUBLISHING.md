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

## Note: scoped-package alternative

If `@cetridr` is an npm **organization** you own (not just a user), you can add the Trusted Publisher
at the **org level** instead, which also covers brand-new packages in the scope. `dsh-whale-rider` is
unscoped, so its first publish is manual regardless.

