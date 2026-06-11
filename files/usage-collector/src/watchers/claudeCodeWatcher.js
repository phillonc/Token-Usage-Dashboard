import path from "node:path";
import chokidar from "chokidar";

/* Claude Code writes one JSONL file per session under
   ~/.claude/projects/<munged-cwd>/<session-id>.jsonl
   Assistant lines carry message.usage:
   { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens }
   and message.model. Lines usually also carry sessionId, cwd, timestamp.

   Aggregation: one canonical record per session × model × local date,
   deterministic id, additively accumulated as new lines appear (idempotent
   via byte cursors). Human fields stay empty — the review queue owns those.

   NOTE: log shapes drift between Claude Code releases. The parser is
   defensive (skips lines it can't read) and logs a count of skipped lines
   so drift is visible rather than silent. */

const localDate = (ts) => {
  const dt = ts ? new Date(ts) : new Date();
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function parseLine(line) {
  let obj;
  try { obj = JSON.parse(line); } catch { return null; }
  const usage = obj?.message?.usage;
  if (!usage) return null;
  return {
    model: obj.message.model || "unknown",
    sessionId: obj.sessionId || "nosession",
    cwd: obj.cwd || "",
    date: localDate(obj.timestamp),
    input: usage.input_tokens || 0,
    output: usage.output_tokens || 0,
    cache_write: usage.cache_creation_input_tokens || 0,
    cache_read: usage.cache_read_input_tokens || 0,
  };
}

export function startClaudeCodeWatcher({ dir, store, cursors, log = console }) {
  const watcher = chokidar.watch(path.join(dir, "**", "*.jsonl"), {
    ignoreInitial: false,   // first run ingests existing history once (cursors prevent repeats)
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });

  const processFile = (filePath) => {
    let lines;
    try { lines = cursors.readNewLines(filePath); } catch (e) { log.warn(`[claude_code] read failed ${filePath}: ${e.message}`); return; }
    let ingested = 0, skipped = 0;

    for (const line of lines) {
      const p = parseLine(line);
      if (!p) { skipped++; continue; }
      const project = p.cwd ? path.basename(p.cwd) : path.basename(path.dirname(filePath));
      const id = `cc-${p.sessionId}-${p.model}-${p.date}`;
      const total = p.input + p.output + p.cache_read + p.cache_write;
      if (total === 0) continue;

      const { inserted, warnings } = store.accumulate(id, {
        date: p.date,
        source: "claude_code",
        vendor: "anthropic",
        tool: "claude-code",
        model: p.model,
        project,
        job: "",
        work_type: "coding",
        fidelity: "exact",
        outcome: "pending",
        review_burden: "", review_worth_it: "", next_move: "", notes: "",
      }, { total, input: p.input, output: p.output, cache_read: p.cache_read, cache_write: p.cache_write });

      warnings.forEach((w) => log.warn("[claude_code] " + w));
      if (inserted) ingested++;
    }
    if (ingested || skipped) log.info(`[claude_code] ${path.basename(filePath)}: +${ingested} usage lines${skipped ? `, ${skipped} skipped (format drift?)` : ""}`);
  };

  watcher.on("add", processFile).on("change", processFile);
  watcher.on("error", (e) => log.error("[claude_code] watcher error: " + e.message));
  log.info(`[claude_code] watching ${dir}`);
  return watcher;
}
