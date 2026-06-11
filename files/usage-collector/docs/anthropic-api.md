# Anthropic API / Console → usage-collector

**Status: RECIPE** (scheduled pull) — highest precedence source for Anthropic usage
**Lane:** EXACT · `source: anthropic_api` · vendor anthropic · **R4 precedence 3 (top)**

## What this source is for
Authoritative, billing-grade token counts per model per day — when available, it should win over parser-derived Claude Code numbers, and R4 makes that automatic: an `anthropic_api` record supersedes any `claude_code` record for the same date × model the moment it's ingested (the loser is marked `superseded_by`, not deleted).

## Recipe
1. Requires org access to the usage/cost Admin API (or a periodic manual export from Console). Personal subscription plans don't expose this — if that's your situation, Claude Code logs remain your source of record and nothing needs doing.
2. Daily cron: pull yesterday's usage grouped by model, map to canonical records (id `aapi-<model>-<date>`), POST to `/api/ingest`.
3. Watch the R4 warnings in the response the first few days — they're the confirmation that supersession is working, not an error.

## Caveats
- Console data covers API-key usage. Claude Code on a subscription plan does NOT appear there — so for subscription sessions there is no overlap and no supersession; both sources coexist correctly because they describe different usage.
- Keep API keys out of this repo; the pull script should read them from your normal secret store.
