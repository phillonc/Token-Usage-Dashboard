# Gemini CLI → usage-collector

**Status: RECIPE** — requires one-time telemetry enablement
**Lane:** EXACT · `source: gemini_cli` · vendor google · R4 precedence 2

## Where the data lives
Gemini CLI emits OpenTelemetry: the `gemini_cli.token.usage` metric (and GenAI-convention `gen_ai.client.token.usage`) plus per-prompt log events. With the local target, logs/metrics land in `~/.gemini/telemetry.log`. `/stats` shows session token usage including cached-token savings.

## Enable (one-time)
In `~/.gemini/settings.json` enable telemetry with the **local** target (file), not a GCP exporter. Run a prompt, then confirm `~/.gemini/telemetry.log` is growing.

## Connector recipe
1. Copy the Claude Code watcher; watch the single `telemetry.log` file.
2. `parseLine()`: extract token-usage entries — model and token type (input/output/cached/thoughts) are attributes on the metric/event. Sum into the canonical breakdown; map thought/reasoning tokens into `output`.
3. Aggregate per **session × model × date** (session id is in the telemetry attributes), id `gm-<session>-<model>-<date>`, `accumulate()` semantics — the log is append-only deltas, which the cursor store handles natively.
4. Add to `config.js` + `server.js` like the others.

## Alternative door (pick ONE)
A local OTLP receiver on :4318 consuming the metric stream directly. More real-time, more moving parts. File-watching wins for simplicity; never run both.

## Caveats
- No telemetry enabled = no data, silently. Make enablement part of machine setup.
- OAuth (personal Google login) vs API-key auth changes cache behaviour and whether usage also appears in AI Studio — if you later pull `google_api` data, R4 precedence 3 handles the overlap.
