# Cetridr 🐋

> **Rule the deep.** A single-window command center for your DeepSeek Harness agents.

> ⚠️ **Experimental.** DeepSeek Harness itself is experimental (`0.1.0-rc.x`), and Cetridr relies on
> DSH's web server not sending `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`.
> If DSH starts sending those headers, iframe embedding breaks and Cetridr will need a different
> embedding strategy. Use at your own risk.

Cetridr runs multiple [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) profiles
(each its own daemon) side by side and switches between them with header-bar tabs, embedding each
DSH web UI in an iframe. Single-user, loopback-only.

[中文文档](README.zh.md)

## Install

```bash
pnpm add -g @cetridr/cetridr   # CLI binary: cetridr
```

### Homebrew

```bash
# from a tap (the formula lives in this repo at homebrew/cetridr.rb)
brew tap cetridr/homebrew-cetridr
brew install cetridr

# or directly from the formula file
brew install ./homebrew/cetridr.rb
```

Zero runtime dependencies. Node >= 24.

## Quick start

```bash
cetridr init                          # create ~/.cetridr/config.json
cetridr add web --port 3080 --external # embed the already-running 3080
cetridr add web2 --port 3081 --home web2  # spawn into an isolated DSH_HOME
cetridr start                         # foreground; prints the tokenized URL (?t=…) — open that
cetridr start --daemon                # background (cetridr stop to stop)
```

## Commands

| Command | Description |
| --- | --- |
| init | create the default config file |
| start [--config <path>] [--daemon] | run the portal (foreground or detached) |
| stop | stop a daemonized portal (via pidfile) |
| list | list configured profiles |
| add <id> --port <n> [--label --emoji --home --external] | add a profile |
| rm <id> | remove a profile |
| status | show runtime status of a running portal |
| logs <id> [--follow] | print (and optionally tail) a profile log |
| service | print a launchd/systemd unit to run at login |

## Configuration

Config lives at `~/.cetridr/config.json` (override the whole home dir with `CETRIDR_HOME`):

```json
{
  "host": "127.0.0.1",
  "port": 4000,
  "dshBin": "dsh",
  "spawnAll": true,
  "restart": true,
  "restartBackoffMs": 1000,
  "profiles": [
    { "id": "web", "port": 3080, "external": true },
    { "id": "web2", "port": 3081, "home": "web2" }
  ]
}
```

- `host` / `port` — the portal listen address (default `127.0.0.1:4000`).
- `dshBin` — the `dsh` executable (default `dsh`).
- `spawnAll` — spawn every profile at startup (default `true`; `false` = spawn on tab click).
- `restart` — auto-restart a crashed child with exponential backoff (default `true`);
  `restartBackoffMs` is the first backoff delay (doubles each attempt, capped at 30s).
- `profiles[].port` — the profile's fixed port; `external: true` means don't spawn, just embed the URL.
- `profiles[].home` — the profile's `DSH_HOME`. Relative paths resolve against `~/.cetridr/homes`;
  `~` or absolute paths are used as-is. Omit to inherit the portal's `DSH_HOME` (shared state).
- `profiles[].command` — optional; fully replaces the default `dsh --profile <id> --port <port>`
  (`{port}` / `{id}` are substituted).
- Security: every `/api/*` request must carry `x-cetridr-token` (token at `~/.cetridr/token`, `0600`);
  `start` prints the full URL with `?t=<token>`.

### Isolation vs shared state

DSH keys its entire home (profiles / sessions / storages / settings / credentials) off the single
`DSH_HOME` env var. Give each profile its own `home` for independent data per tab; omit it to share.

### Attention badges (working / idle / blocked)

Install the [whale-rider](packages/whale-rider) host plugin inside each DSH daemon; it reports the
agent lifecycle back to Cetridr's `/api/report`, which shows working / idle / blocked on the tab and
highlights a blocked, non-active tab. Cetridr injects `CETRIDR_URL` / `CETRIDR_ID` / `CETRIDR_TOKEN`
into spawned children; the plugin reports via those.

## Development

```bash
pnpm install                          # install workspace deps
pnpm run build                        # tsc -> lib/ + copy cetridr.html
pnpm test                             # node --test test/*.test.mjs
pnpm run typecheck
pnpm --filter dsh-whale-rider run build
```

Source in `src/` (TypeScript, ESM); build output in `lib/` (gitignored).

## Why iframe embedding works

- DSH's web server sends no `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`, so it can be embedded.
- DSH's `/api` trust fence only checks that `Host` is loopback (no cookie/auth layer); an iframe whose
  `src` points straight at DSH is same-origin, so `Host=127.0.0.1:<port>` passes — no third-party cookies.
- Each profile uses `--port` for a fixed port; the portal health-checks `http://127.0.0.1:<port>/`.

## Architecture

```
src/cli.ts        CLI entry (init/start/stop/list/add/rm/status/logs/service)
src/config.ts     config schema + validation + read/write + home resolution
src/paths.ts      CETRIDR_HOME / data-dir resolution
src/supervisor.ts process supervision: spawn/stop/restart + health + auto-restart backoff
src/server.ts     HTTP: portal page + /api/config + /api/status + /api/{start,stop,restart}/:id
src/auth.ts       token generation/persistence + x-cetridr-token check
src/logger.ts     per-profile timestamped log files
src/cetridr.html  header tabs + iframe switching frontend (zero deps)
packages/whale-rider  DSH host plugin that reports agent lifecycle back to Cetridr
```

## Roadmap

- [x] M1 skeleton: TypeScript, CLI, config/data dirs, schema validation, unit tests
- [x] M2 reliability: daemonize, auto-restart backoff, lazy start, log aggregation, control-plane token
- [x] M3 usability: in-UI profile management, log viewer, working/idle/blocked badges (via whale-rider)
- [x] M4 distribution: launchd/systemd unit generation (`service`); npm publish pending
- [ ] Port auto-allocation (deferred)

## Publishing

See [PUBLISHING.md](PUBLISHING.md) for the one-time setup and release flow.

## License

[MIT](LICENSE)
