# Copilot CLI → usage-collector

**Status: BUILT** (`src/watchers/copilotCliWatcher.js`, on by default)
**Lane:** EXACT (tokens) + secondary ACTIVITY (`premium_requests`) · `source: copilot_cli` · vendor github · R4 precedence 2

## Where the data lives
`~/.copilot/session-state/<session-id>/events.jsonl` (override root with `COPILOT_HOME`), with `workspace.yaml` metadata alongside. The **`session.shutdown` event** carries server-reported token totals, cache stats, and premium-request usage — `/usage` in-session shows the same per-model numbers live.

## How the connector works
Watches `session-state/*/events.jsonl` and ingests **only shutdown events** — totals are final, so each session is inserted exactly once (deterministic ids `cp-<session>-<model>-<date>`, plus `cp-prem-<session>-<date>` for premium requests). The event schema is not a public contract, so the parser deep-searches shutdown events for token-shaped fields (`inputTokens`/`input_tokens`/`promptTokens` etc.) and per-model breakdowns rather than hard-coding paths. Project comes from `workspace.yaml`'s cwd.

## Config
`COPILOT_SESSION_DIR` to override · `WATCH_COPILOT_CLI=0` to disable.

## The two-lane subtlety
A session produces an exact record (tokens) AND an activity record (premium requests) — the same work measured in two currencies. They live in different lanes and are never summed (R2); premium requests matter because they're what GitHub actually bills against.

## Caveats
- **Sessions killed without clean shutdown are not counted** — no shutdown event, no record. Crash-heavy days will under-report; the gap is visible as "fewer sessions than you remember", not as wrong numbers.
- Copilot's auto model routing means some records may carry an empty model; the registry doesn't mind (`model` is optional).
- Copilot IDE usage is a different source (`copilot_ide`, ceiling ACTIVITY) — never log IDE usage as `copilot_cli`.
- Schema drift: "shutdown event had no recognisable token fields" warnings mean the parser needs a look.
