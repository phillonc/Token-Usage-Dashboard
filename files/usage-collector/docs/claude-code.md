# Claude Code → usage-collector

**Status: BUILT** (`src/watchers/claudeCodeWatcher.js`, on by default)
**Lane:** EXACT · `source: claude_code` · vendor anthropic · R4 precedence 2

## Where the data lives
One JSONL file per session under `~/.claude/projects/<munged-cwd>/<session-id>.jsonl`. Assistant lines carry `message.usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) and `message.model`; lines also include `sessionId`, `cwd`, `timestamp`. Nothing to enable — these logs exist already.

## How the connector works
Watches the directory, reads only new bytes (cursor per file in `data/cursors.json`), and additively accumulates one record per **session × model × local date** with deterministic id `cc-<session>-<model>-<date>`. Project is inferred from `cwd` basename. First start ingests existing history once.

## Config
`CLAUDE_PROJECTS_DIR` to override the path · `WATCH_CLAUDE_CODE=0` to disable.

## One-door rule
Claude Code can ALSO export OTel (`CLAUDE_CODE_ENABLE_TELEMETRY=1` + OTLP env vars). Do not point that at this collector while the JSONL watcher runs — same source, two doors, double count. JSONL watching is the default here because logs persist when the collector is down.

## Caveats
- Parser-accurate, not billing-accurate: per-message usage blocks are summed. If you ever ingest Anthropic Console data (`anthropic_api`, precedence 3), R4 supersedes these records automatically for the same date × model.
- Log shape drifts between releases; skipped-line counts in the collector log are your drift alarm.
- Subscription vs API-key sessions look identical in the logs; the R4 question only matters if you also pull Console data.
