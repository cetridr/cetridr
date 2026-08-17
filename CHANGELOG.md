# Changelog

## 0.2.4

- Homebrew formula sha256 now comes from the GitHub Release asset digest (no npm-CDN fetch or retry).

## 0.2.2

- CI: pass the tarball sha256 from the publish job to the formula bump (no CDN-lag dependency).

## 0.2.1

- Require Node.js >= 24.
- Publish on GitHub Release (`gh release create`) instead of a bare tag.
- Homebrew tap renamed to `cetridr/tap` (`homebrew-tap` repo).

## 0.2.0

### M1 skeleton
- TypeScript build + type declarations + `node:test` unit tests.
- CLI: init / start / list / add / rm / status.
- Config & data moved to `~/.cetridr` (`CETRIDR_HOME` overrides).
- Config schema validation.

### M2 reliability
- Control-plane token (`x-cetridr-token` gates `/api/*`; token at `~/.cetridr/token`, 0600).
- Per-profile log files + `logs <id> [--follow]`.
- Crash auto-restart (exponential backoff, `restartBackoffMs`).
- Lazy start (`spawnAll: false`).
- `start --daemon` + `stop` (pidfile).

### M3 usability
- In-UI profile management: add / remove / rename / drag-to-reorder (persisted to config.json).
- Log viewer panel.
- working / idle / blocked attention badges (via `dsh-whale-rider` reporting to `/api/report`).

### M4 distribution
- `service` command: generate launchd (macOS) / systemd (Linux) units.
- npm publish via GitHub Actions + OIDC trusted publishing (pending first publish).
