import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import { CONFIG } from "./config.js";
import { SOURCE_REGISTRY } from "./registry.js";
import { Store } from "./store.js";
import { CursorStore } from "./watchers/cursorStore.js";
import { startClaudeCodeWatcher } from "./watchers/claudeCodeWatcher.js";
import { startCopilotCliWatcher } from "./watchers/copilotCliWatcher.js";
import { migrate, validateRecord, REVIEW_FIELDS } from "./validate.js";

const store = new Store(CONFIG.logFile);
const cursors = new CursorStore(CONFIG.cursorFile);
const app = express();
app.use(express.json({ limit: "5mb" }));

/* CORS for the dashboard dev server (localhost only — this service must never be exposed) */
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, records: store.all().length }));
app.get("/api/registry", (_req, res) => res.json(SOURCE_REGISTRY));

/* Dashboard reads here (superseded R4 losers filtered by default) */
app.get("/api/records", (req, res) => {
  res.json(store.all({ includeSuperseded: req.query.includeSuperseded === "1" }));
});

/* Door 3 — machine intake: single record or array. Pi exporter posts here. */
app.post("/api/ingest", (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body];
  const report = { accepted: 0, rejected: [], warnings: [] };
  for (const raw of payload) {
    const r = migrate(raw);
    const errs = validateRecord(r);
    if (errs.length) { report.rejected.push({ record: raw, errors: errs }); continue; }
    r.id = r.id || `${r.source}-${crypto.randomUUID()}`;
    const { inserted, warnings } = store.insert(r);
    report.warnings.push(...warnings);
    if (inserted) report.accepted++;
  }
  res.status(report.rejected.length && !report.accepted ? 422 : 200).json(report);
});

/* Manual entry from the dashboard form */
app.post("/api/records", (req, res) => {
  const r = migrate(req.body);
  const errs = validateRecord(r);
  if (errs.length) return res.status(422).json({ errors: errs });
  r.id = r.id || `manual-${crypto.randomUUID()}`;
  const { inserted, warnings } = store.insert(r);
  res.json({ inserted, warnings, record: r });
});

/* Review edits — whitelisted fields only: humans own judgments, machines own quantities */
app.put("/api/records/:id", (req, res) => {
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => REVIEW_FIELDS.includes(k)));
  const updated = store.update(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "not found" });
  res.json(updated);
});

/* Backup convenience: full export, same shape the dashboard import accepts */
app.get("/api/export", (_req, res) => {
  res.set("Content-Disposition", `attachment; filename=usage-log-${new Date().toISOString().slice(0, 10)}.json`);
  res.json(store.all({ includeSuperseded: true }));
});

app.listen(CONFIG.port, "127.0.0.1", () => {
  console.info(`usage-collector on http://127.0.0.1:${CONFIG.port} · records: ${store.all().length} · log: ${CONFIG.logFile}`);

  /* Door 2 — watchers (one door per source, see README) */
  const cc = CONFIG.watchers.claude_code;
  if (cc.enabled) {
    if (fs.existsSync(cc.dir)) startClaudeCodeWatcher({ dir: cc.dir, store, cursors });
    else console.warn(`[claude_code] dir not found: ${cc.dir} — watcher idle (set CLAUDE_PROJECTS_DIR or WATCH_CLAUDE_CODE=0)`);
  }
  const cp = CONFIG.watchers.copilot_cli;
  if (cp.enabled) {
    if (fs.existsSync(cp.dir)) startCopilotCliWatcher({ dir: cp.dir, store, cursors });
    else console.warn(`[copilot_cli] dir not found: ${cp.dir} — watcher idle (set COPILOT_SESSION_DIR or WATCH_COPILOT_CLI=0)`);
  }
});
