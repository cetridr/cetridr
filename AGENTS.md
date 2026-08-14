# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Cetridr ("rule the deep") is a single-window command center for DeepSeek Harness (DSH). It runs
multiple DSH profiles (each its own daemon) and switches between them with header-bar tabs, embedding
each DSH web UI in an iframe. Single-user, loopback-only.

## Repo layout (pnpm monorepo)

- root `package.json` — `@cetridr/cetridr`, the CLI. Source in `src/`, tests in `test/`.
- `packages/whale-rider/` — `dsh-whale-rider`, a DSH host plugin that reports agent lifecycle back.

## Commands

```bash
pnpm install
pnpm run build       # tsc -> lib/ + copy src/cetridr.html -> lib/cetridr.html
pnpm test            # node --test test/*.test.mjs
pnpm run typecheck
pnpm --filter dsh-whale-rider run build   # tsc (declarations) + tsdown (bundle)
```

## Architecture

- `src/cli.ts` — CLI entry (init / start / stop / list / add / rm / status / logs / service).
- `src/config.ts` — config schema + validation + read/write + `home` resolution.
- `src/paths.ts` — `CETRIDR_HOME` / data-dir resolution (`~/.cetridr`).
- `src/supervisor.ts` — process supervision: spawn/stop/restart, health checks, auto-restart backoff.
- `src/server.ts` — HTTP: portal page + `/api/config` + `/api/status` + `/api/{start,stop,restart}/:id`
  + `/api/profiles` CRUD + `/api/logs/:id` + `/api/report`.
- `src/auth.ts` — token generation/persistence + `x-cetridr-token` check.
- `src/logger.ts` — per-profile timestamped log files.
- `src/cetridr.html` — the tabbed frontend (zero deps, vanilla JS), read at runtime via
  `new URL('./cetridr.html', import.meta.url)`.

## Conventions

- TypeScript, ESM, `strict`, zero runtime dependencies.
- English-first docs: `README.md` is canonical; `README.zh.md` is the Chinese translation. Same for
  `packages/whale-rider/`.
- The two packages are versioned together (same version string).
- Never commit `lib/`, `node_modules/`, or `homes/` (gitignored).

## Gotchas

- **iframe fragility (important)**: Cetridr works only because DSH's web server sends no
  `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`. DSH is experimental (`0.1.0-rc.x`);
  if it starts sending those headers, iframe embedding breaks and Cetridr needs a new embedding strategy.
- The portal HTML is NOT bundled; `scripts/copy-assets.mjs` copies `src/cetridr.html` to `lib/` as a
  post-build step. The runtime import expects `./cetridr.html` next to `lib/server.js`.
- `dsh-whale-rider` is a single-face host plugin: `tsc` emits declarations to `lib/types/`, then
  `tsdown` bundles `lib/types/index.js` -> `lib/index.js` (see `tsdown.config.ts`, `fixedExtension: false`).
- The reporter reads `CETRIDR_URL` / `CETRIDR_ID` / `CETRIDR_TOKEN`, injected by the supervisor into
  spawned children; it is a no-op without them.
- In sandboxed environments the npm cache (`~/.npm/_cacache`) may be unwritable; set
  `npm_config_cache` to a writable dir for `pnpm publish`.
- Config/data lives in `~/.cetridr` (`CETRIDR_HOME` overrides).

## Publishing

See [PUBLISHING.md](PUBLISHING.md). Release = bump both `package.json` versions, commit, push, then
`gh release create vX.Y.Z`; GitHub Actions publishes both via OIDC trusted publishing and bumps the
Homebrew formula.

