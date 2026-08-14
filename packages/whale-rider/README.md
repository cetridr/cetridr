# dsh-whale-rider

A [Cetridr](../..) companion: a DSH host plugin that reports the agent lifecycle back to Cetridr,
so it can show working / idle / blocked badges (and a "needs attention" highlight) on header tabs.

[中文文档](README.zh.md)

Structurally identical to `dsh-system-notify`: a pure-Node, single-face host plugin that observes
host events and never preempts decisions.

## Status mapping

| Reports | DSH signal (host event) |
| --- | --- |
| working | `agent/status` — any session running |
| idle | `agent/status` — all sessions idle |
| blocked | `approval/request` (waterfall; `await next()`, never preempts) |

## Install

1. Install into a profile (after publish): `dsh plugin --profile <name> add dsh-whale-rider`
   (from source: `dsh plugin --profile <name> add ./packages/whale-rider`).
2. Add one row to the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: whale-rider
      name: 'dsh-whale-rider'
```

## Activation guard

Only active when Cetridr injected these env vars into the spawned child; otherwise a no-op:

- `CETRIDR_URL` — Cetridr's URL (`http://127.0.0.1:<port>`)
- `CETRIDR_ID` — this profile's id
- `CETRIDR_TOKEN` — Cetridr's token (sent as `x-cetridr-token`)

Target: `POST CETRIDR_URL/api/report` with body `{ id, state, detail }`.

## Build

```bash
pnpm install     # cordis + typescript + tsdown + @types/node
pnpm run build   # tsc (declarations -> lib/types/) + tsdown (bundle -> lib/index.js)
pnpm run typecheck
```
