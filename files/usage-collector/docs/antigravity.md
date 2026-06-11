# Antigravity → usage-collector

**Status: NO DIRECT INTEGRATION POSSIBLE** — and the model is honest about it
**Lane ceiling:** ACTIVITY · `source: antigravity` · vendor google · R4 precedence 1

## The situation
Antigravity exposes no token counts, no usage log, no telemetry hook. Its registry ceiling is ACTIVITY, enforced by R7 — the collector physically rejects any antigravity record claiming exact tokens. Do not be tempted to estimate tokens for it; that's what the estimate lane (via `manual`) is for, and even that is a band, never a number.

## Best available: launcher wrapper (optional)
A shell function that logs one session record, then launches the app:

    antigravity() {
      curl -s -X POST http://127.0.0.1:4600/api/ingest \
        -H 'Content-Type: application/json' \
        -d "{\"date\":\"$(date +%F)\",\"source\":\"antigravity\",\"tool\":\"antigravity\",\"project\":\"${1:-unknown}\",\"job\":\"\",\"work_type\":\"coding\",\"fidelity\":\"activity\",\"activity_count\":1,\"activity_unit\":\"sessions\"}" > /dev/null
      open -a "Antigravity"
    }

Worth it only if you launch from a terminal and care about the count. If you launch from the dock, log manually or accept the gap.

## If Google ships usage data later
Raise the registry ceiling (one line in `src/registry.js` + the dashboard copy), note the date in a registry changelog, and build a connector then. Historical activity records stay as they are — never retro-upgraded.
