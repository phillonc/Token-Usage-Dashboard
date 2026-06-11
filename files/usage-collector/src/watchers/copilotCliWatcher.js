import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

/* Copilot CLI stores per-session telemetry at
   ~/.copilot/session-state/<session-id>/events.jsonl   (COPILOT_HOME overridable)
   plus workspace.yaml metadata alongside.

   The session.shutdown event carries server-reported token totals, cache
   stats, and premium-request costs — that's our ingestion point: one exact
   record per session (per model where a breakdown is present), emitted once,
   when the session ends cleanly.

   The event schema is NOT a stable public contract, so this parser is
   deliberately defensive: it identifies shutdown-ish events by name and
   deep-searches them for token-shaped fields rather than hard-coding paths.
   Skipped/unparseable shutdowns are logged so drift is a number, not silence.

   Also emitted: a secondary ACTIVITY record (premium_requests) when the
   shutdown reports them — different lane, never summed with tokens (R2). */

const MAX_DEPTH = 8;

const localDate = (ts) => {
  const dt = ts ? new Date(ts) : new Date();
  return Number.isNaN(dt.getTime())
    ? new Date().toISOString().slice(0, 10)
    : new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const KEY = {
  input: /^(input.?tokens|prompt.?tokens|in)$/i,
  output: /^(output.?tokens|completion.?tokens|out)$/i,
  cache_read: /^(cache.?read.?(input.?)?tokens?|cached.?tokens?|cache.?hits?)$/i,
  cache_write: /^(cache.?(creation|write).?(input.?)?tokens?)$/i,
  total: /^(total.?tokens?|token.?usage)$/i,
  premium: /^(premium.?requests?(.?used|.?est(imate)?d?)?)$/i,
  model: /^(model|model.?id|model.?name)$/i,
};

function isShutdownEvent(e) {
  const name = String(e?.type ?? e?.event ?? e?.name ?? "");
  return /shutdown/i.test(name);
}

/* Deep-search a node for token-shaped numeric fields. Returns usage clusters,
   each optionally tagged with the nearest model string. */
function extractUsages(node, depth = 0, inheritedModel = "") {
  if (!node || typeof node !== "object" || depth > MAX_DEPTH) return [];
  const out = [];
  const usage = { input: 0, output: 0, cache_read: 0, cache_write: 0, total: 0, premium: 0 };
  let found = false;
  let model = inheritedModel;

  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string" && KEY.model.test(k)) model = v;
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "number") {
      for (const field of ["input", "output", "cache_read", "cache_write", "total", "premium"]) {
        if (KEY[field].test(k)) { usage[field] += v; found = found || field !== "premium"; if (field === "premium") usage._hasPremium = true; }
      }
    }
  }
  if (found || usage._hasPremium) out.push({ ...usage, model });

  for (const v of Object.values(node)) {
    if (v && typeof v === "object") out.push(...extractUsages(v, depth + 1, model));
  }
  return out;
}

/* Merge clusters per model; prefer explicit components over bare totals. */
function summarise(clusters) {
  const byModel = new Map();
  for (const c of clusters) {
    const key = c.model || "";
    const m = byModel.get(key) || { input: 0, output: 0, cache_read: 0, cache_write: 0, total: 0, premium: 0 };
    for (const f of ["input", "output", "cache_read", "cache_write", "total", "premium"]) m[f] += c[f] || 0;
    byModel.set(key, m);
  }
  return [...byModel.entries()].map(([model, m]) => {
    const componentSum = m.input + m.output + m.cache_read + m.cache_write;
    return { model, ...m, token_count: componentSum > 0 ? componentSum : m.total };
  }).filter((m) => m.token_count > 0 || m.premium > 0);
}

/* Best-effort project from workspace.yaml next to events.jsonl (no yaml dep). */
function projectFromWorkspace(sessionDir) {
  try {
    const y = fs.readFileSync(path.join(sessionDir, "workspace.yaml"), "utf8");
    const m = y.match(/^\s*(?:cwd|path|workspace|root|dir)\s*:\s*["']?([^"'\n]+)["']?\s*$/mi);
    if (m) return path.basename(m[1].trim());
  } catch { /* no workspace.yaml — fine */ }
  return "";
}

export function startCopilotCliWatcher({ dir, store, cursors, log = console }) {
  const watcher = chokidar.watch(path.join(dir, "*", "events.jsonl"), {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 120 },
  });

  const processFile = (filePath) => {
    let lines;
    try { lines = cursors.readNewLines(filePath); } catch (e) { log.warn(`[copilot_cli] read failed ${filePath}: ${e.message}`); return; }
    const sessionDir = path.dirname(filePath);
    const sessionId = path.basename(sessionDir);
    let ingested = 0, shutdownsSeen = 0, unparsed = 0;

    for (const line of lines) {
      let e;
      try { e = JSON.parse(line); } catch { unparsed++; continue; }
      if (!isShutdownEvent(e)) continue;
      shutdownsSeen++;

      const date = localDate(e.timestamp ?? e.time ?? e.ts ?? e.createdAt);
      const project = projectFromWorkspace(sessionDir);
      const models = summarise(extractUsages(e));
      if (models.length === 0) { log.warn(`[copilot_cli] shutdown event in ${sessionId} had no recognisable token fields (schema drift?)`); continue; }

      for (const m of models) {
        if (m.token_count > 0) {
          const id = `cp-${sessionId}-${m.model || "all"}-${date}`;
          if (store.get(id)) continue; // shutdown totals are final — never re-add
          const { inserted, warnings } = store.insert({
            id, date, source: "copilot_cli", vendor: "github", tool: "copilot-cli",
            model: m.model, project, job: "", work_type: "coding",
            fidelity: "exact", token_count: m.token_count,
            breakdown: { input: m.input, output: m.output, cache_read: m.cache_read, cache_write: m.cache_write },
            outcome: "pending", review_burden: "", review_worth_it: "", next_move: "", notes: "",
          });
          warnings.forEach((w) => log.warn("[copilot_cli] " + w));
          if (inserted) ingested++;
        }
        if (m.premium > 0) {
          const id = `cp-prem-${sessionId}-${date}`;
          if (!store.get(id)) {
            store.insert({
              id, date, source: "copilot_cli", vendor: "github", tool: "copilot-cli",
              model: m.model, project, job: "", work_type: "coding",
              fidelity: "activity", activity_count: m.premium, activity_unit: "premium_requests",
              outcome: "pending", review_burden: "", review_worth_it: "", next_move: "",
              notes: "secondary metric for the same session as its exact record — different lane, never summed",
            });
            ingested++;
          }
        }
      }
    }
    if (ingested || unparsed) log.info(`[copilot_cli] ${sessionId}: ${shutdownsSeen} shutdown(s), +${ingested} records${unparsed ? `, ${unparsed} unparsed lines` : ""}`);
  };

  watcher.on("add", processFile).on("change", processFile);
  watcher.on("error", (e) => log.error("[copilot_cli] watcher error: " + e.message));
  log.info(`[copilot_cli] watching ${dir} (sessions only count when they shut down cleanly)`);
  return watcher;
}
