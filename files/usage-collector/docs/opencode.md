# OpenCode → usage-collector

**Status: RECIPE** — two viable doors, scheduled pull recommended
**Lane:** EXACT · `source: opencode_cli` · vendor multi · R4 precedence 2

## Where the data lives
Session/message store under `~/.local/share/opencode/storage/` (override with `OPENCODE_DATA_DIR`); messages carry per-model token counts. `opencode stats` prints token usage and cost; `opencode export <session>` emits session JSON.

## Connector recipe (door A — scheduled pull, recommended)
A small script on cron / launchd:
1. `opencode export` recent sessions (or read the storage dir directly).
2. Transform per-session per-model token totals into canonical records (id `oc-<session>-<model>-<date>`).
3. POST the batch to `http://127.0.0.1:4600/api/ingest` — the collector's validation, R4, and dedupe-by-id handle repeats safely, so the script can be naive.

## Connector recipe (door B — storage watcher)
Watch the storage directory like the Claude Code watcher. More real-time, but OpenCode's storage layout is an internal detail and has changed before (newer builds use SQLite) — expect more maintenance.

## OpenCode is the multi-provider hub
It routes to Anthropic, OpenAI, Google, and local models. Keep `vendor: multi` on the source but record the real `model` faithfully — the dashboard's group-by-model view is where OpenCode usage becomes comparable with the native CLIs. R4 note: OpenCode-via-API-key usage may also appear in that vendor's console; precedence handles it if you pull both, but only matches when date × vendor × model align — OpenCode records carry vendor "multi", so console data will NOT supersede them automatically. If you run OpenCode on vendor API keys AND pull console data, pick one source per provider deliberately.

## Caveats
- `cost: 0` in message files is normal — OpenCode computes cost from external pricing tables; ignore cost, take tokens.
- Subagent sessions roll up in stats; check whether your export double-reports parent+child before trusting totals.
