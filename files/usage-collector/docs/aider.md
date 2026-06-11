# Aider → usage-collector

**Status: RECIPE** (lightweight)
**Lane:** EXACT · `source: aider` · vendor multi · R4 precedence 2

## Where the data lives
Aider prints per-exchange token counts and writes `.aider.chat.history.md` (and optional analytics/LLM history files) in the working repo. There's no central log directory — history lives per-project.

## Connector recipe
Two pragmatic options:
1. **LLM history file**: run aider with its LLM history flag enabled, then a small parser sums per-exchange usage and POSTs daily records to `/api/ingest` (id `ai-<repo>-<model>-<date>`).
2. **Manual-assisted**: if aider use is occasional, skip automation — log a manual record from the session-end token summary. The registry ceiling for `aider` is exact, so hand-copied real numbers are legitimate exact-lane entries.

## Caveats
- Per-repo history files mean the "watch one directory" pattern doesn't fit; a find-across-repos cron or per-repo git hook works better.
- If aider runs on the same API keys as other tools, the vendor console sees the combined total — same `vendor: multi` R4 limitation as OpenCode (see opencode.md).
