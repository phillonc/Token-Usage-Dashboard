# Codex CLI → usage-collector

**Status: RECIPE** (copy `claudeCodeWatcher.js`, swap the parser)
**Lane:** EXACT · `source: codex_cli` · vendor openai · R4 precedence 2

## Where the data lives
Rollout/session logs under `~/.codex/sessions/`, containing `token_count` events with `total_tokens`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`. In-session, `/status` shows current session usage and `/statusline` keeps counters visible.

## Connector recipe
1. Copy the Claude Code watcher; point it at `~/.codex/sessions/**` (JSONL).
2. `parseLine()`: match `token_count` events; map `input_tokens→input`, `output_tokens + reasoning_output_tokens→output`, `cached_input_tokens→cache_read`, `cache_write: 0`.
3. **Counts are cumulative-style snapshots in some versions** — verify against your installed version whether events report deltas or running totals before choosing `accumulate()` (deltas) vs last-snapshot-wins via `insert`/replace (totals). Check one real session log by hand first; this is the only genuinely version-sensitive decision.
4. Id scheme `cx-<session>-<model>-<date>`; project from the session's recorded cwd if present, else "".
5. Register in `config.js` (`codex_cli` stub is already there) and start in `server.js`.

## Caveats
- Codex startup itself consumes tokens (context loading) — expect nonzero records for sessions where you "did nothing"; that's real usage, not a parser bug, and exactly the kind of thing the review queue should catch.
- OpenAI Platform usage (`openai_api`, precedence 3) supersedes these via R4 if you later pull it — relevant only for API-key auth, not ChatGPT-plan auth.
