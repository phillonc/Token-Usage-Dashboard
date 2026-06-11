# Pi agents → usage-collector

**Status: CONTRACT PROVIDED** (`examples/pi-exporter.ts`) — best-connected source of all
**Lane:** EXACT or ACTIVITY — decide once (TRD open question #1) · `source: pi_telemetry` · vendor multi · R4 precedence 2

## Why this one is special
You own the telemetry extension, so this is the only source where the canonical record is constructed at the origin: emit `project`, `job`, and `work_type` properly and Pi records arrive needing zero enrichment — only the human review fields stay pending.

## Wiring
Drop `examples/pi-exporter.ts` into the telemetry extension and call `exportUsage()` at run end. It POSTs to `/api/ingest`; rejections and R4 warnings come back in the response and are logged, never thrown — a down collector must never break an agent run.

## The lane decision (make it before real data accumulates)
- Extension captures per-run token counts → `fidelity: "exact"`, `token_count` + breakdown.
- Extension only counts runs/tool calls → `fidelity: "activity"`, `activity_count` + unit `runs`.
Pick one per fleet and stay consistent. Records logged at one fidelity are never retro-upgraded.

## Hardening (optional, recommended for overnight fleets)
Add a local spool file in the exporter: on POST failure, append the record to `~/.pi-usage-spool.jsonl`; on next successful run, drain the spool first. Deterministic ids (`pi-<run-id>`) make redelivery safe — the collector's insert-by-id is idempotent.

## Caveats
- Batch runs spanning midnight: date the record by run START, consistently.
- Fleet-wide totals can be enormous and will dominate the exact lane's top-days list — that's the point. Expect the review queue to keep asking whether overnight runs ship anything.
