# usage-collector

Local collector for multi-vendor LLM usage. Three doors in, one canonical record out, `data/usage-log.json` as the system of record.

```
┌─ Door 1: file watchers ──── Claude Code JSONL (built) · Copilot CLI shutdown events (built) · Codex/Gemini/OpenCode (recipes in docs/)
├─ Door 2: HTTP ingest ────── POST /api/ingest  (Pi exporter, Ollama middleware, scripts)
├─ Door 3: manual API ─────── POST /api/records (dashboard form)
│
▼  migrate → validate (R1, R7) → dedupe (R4, supersede not delete) → usage-log.json
```

## Run

```bash
npm install
npm start          # http://127.0.0.1:4600
```

On first start the Claude Code watcher ingests existing history once (byte cursors in `data/cursors.json` make every subsequent read incremental and restart-safe). Logs not found? Set `CLAUDE_PROJECTS_DIR`, or disable with `WATCH_CLAUDE_CODE=0`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/records` | All records (R4-superseded filtered; `?includeSuperseded=1` for audit) |
| POST | `/api/ingest` | Machine intake — record or array; returns accepted/rejected/warnings report |
| POST | `/api/records` | Manual entry (dashboard form) |
| PUT | `/api/records/:id` | Review edits — whitelisted human fields only |
| GET | `/api/export` | Download full log (backup; commit it or push to R2) |
| GET | `/api/registry` | Source registry (ceilings + precedence) |
| GET | `/health` | Liveness + record count |

Binds to `127.0.0.1` only. There is no auth — do not expose this port.

## THE ONE-DOOR RULE (read this)

**Exactly one intake per source.** Claude Code via both the JSONL watcher *and* OTel would double-count itself — R4 dedupes *across* sources, not within one. If you later add an OTel receiver for Claude Code, set `WATCH_CLAUDE_CODE=0` first.

Division of labour: **machines report cost, you report value.** Watcher records arrive with quantities, inferred project, and `outcome: "pending"` — the dashboard review queue is where outcome / burden / worth-it / next-move get filled. The PUT whitelist enforces this; nothing machine-side can write judgments.

## Wire the dashboard (≈30-line diff)

In `UsageRecorder.jsx`:

```jsx
const API = "http://127.0.0.1:4600";

// 1. Replace useState(SAMPLE) with empty + fetch on mount:
const [records, setRecords] = useState([]);
useEffect(() => {
  fetch(`${API}/api/records`).then(r => r.json()).then(setRecords).catch(() => {});
}, []);

// 2. addRecord → POST, then refresh:
const addRecord = async (raw) => {
  const res = await fetch(`${API}/api/records`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(raw),
  });
  if (!res.ok) { alert("Rejected: " + (await res.json()).errors.join("; ")); return false; }
  setRecords(await (await fetch(`${API}/api/records`)).json());
  return true;
};

// 3. updateRecord → PUT, optimistic local update:
const updateRecord = async (id, patch) => {
  setRecords(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  await fetch(`${API}/api/records/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
  });
};
```

Import/Export buttons can stay (export doubles as backup) or point at `/api/export`. Delete `SAMPLE` and the sample-data banner once wired — the collector is now the source of truth.

## Built-in watchers

- **Claude Code** (`WATCH_CLAUDE_CODE=0` to disable, `CLAUDE_PROJECTS_DIR` to override) — per-message usage blocks, accumulated per session × model × date.
- **Copilot CLI** (`WATCH_COPILOT_CLI=0` to disable, `COPILOT_SESSION_DIR` to override) — `session.shutdown` events from `~/.copilot/session-state/*/events.jsonl`; per-model exact records plus a secondary premium-requests activity record. Sessions that don't shut down cleanly are not counted.

## Adding the next connector

**Every integration has its own doc in `docs/`** — see `docs/_index.md`. Built: claude-code, copilot-cli. Recipes: codex-cli, gemini-cli, opencode, aider, anthropic-api, local-llm. Contract: pi-telemetry. Honest no: antigravity.

Before writing all the recipes, evaluate wrapping **tokscale** or **ccusage** as the parsing layer (they already track these log formats, which drift with every CLI release) and transforming their output into canonical records via `/api/ingest`.

## Pi exporter

See `examples/pi-exporter.ts` — the POST contract for your telemetry extension. Decide exact vs activity once (does it capture token counts?) and stay consistent.

## Honest caveats

- The Claude Code parser sums per-message `usage` blocks; treat totals as parser-accurate, not billing-accurate. If you ever ingest Console data, R4 makes it win automatically.
- Log formats drift between CLI releases. The watcher logs skipped-line counts so drift shows up as a number, not silence.
- `data/usage-log.json` is the asset. Back it up (private git repo or R2); the review history is the part with real value.
