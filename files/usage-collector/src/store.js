import fs from "node:fs";
import path from "node:path";
import { SOURCE_REGISTRY } from "./registry.js";

/* JSON-file store. usage-log.json is the system of record.
   - insert(): new record; applies R4 against existing exact records.
   - accumulate(): additive upsert for watcher-derived records (idempotent per delta).
   - update(): patch (used for review edits).
   R4 policy: nothing is deleted — losers are marked superseded_by and
   filtered out of the default read, so the audit trail survives. */

export class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.records = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
    this.byId = new Map(this.records.map((r) => [r.id, r]));
  }

  persist() {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.records, null, 2));
    fs.renameSync(tmp, this.file); // atomic on same fs
  }

  all({ includeSuperseded = false } = {}) {
    return includeSuperseded ? this.records : this.records.filter((r) => !r.superseded_by);
  }

  get(id) { return this.byId.get(id); }

  prec(r) { return SOURCE_REGISTRY[r.source]?.prec ?? 0; }
  r4key(r) { return `${r.date}|${r.vendor}|${r.model || "?"}`; }

  /* R4: returns { action: "insert" | "skip", warnings: [] } and applies supersedes. */
  applyR4(incoming) {
    const warnings = [];
    if (incoming.fidelity !== "exact") return { action: "insert", warnings };
    const key = this.r4key(incoming);
    const rivals = this.records.filter(
      (r) => r.fidelity === "exact" && !r.superseded_by && r.id !== incoming.id && this.r4key(r) === key && r.source !== incoming.source
    );
    for (const rival of rivals) {
      if (this.prec(rival) > this.prec(incoming)) {
        warnings.push(`R4: skipped ${incoming.source} record for ${key} — superseded by existing ${rival.source} (${rival.id})`);
        return { action: "skip", warnings };
      }
      if (this.prec(rival) < this.prec(incoming)) {
        rival.superseded_by = incoming.id;
        warnings.push(`R4: existing ${rival.source} record ${rival.id} superseded by ${incoming.source} for ${key}`);
      }
    }
    return { action: "insert", warnings };
  }

  insert(record) {
    const { action, warnings } = this.applyR4(record);
    if (action === "skip") return { inserted: false, warnings };
    this.records.push(record);
    this.byId.set(record.id, record);
    this.persist();
    return { inserted: true, warnings };
  }

  /* Additive upsert keyed by deterministic id. Watchers feed deltas as new
     log lines appear; quantities sum, human fields are never overwritten. */
  accumulate(id, base, deltas) {
    let r = this.byId.get(id);
    if (!r) {
      r = { ...base, id, token_count: 0, breakdown: { input: 0, output: 0, cache_read: 0, cache_write: 0 } };
      const { action, warnings } = this.applyR4({ ...r, token_count: deltas.total });
      if (action === "skip") return { inserted: false, warnings };
      this.records.push(r);
      this.byId.set(id, r);
    }
    r.token_count += deltas.total;
    r.breakdown.input += deltas.input;
    r.breakdown.output += deltas.output;
    r.breakdown.cache_read += deltas.cache_read;
    r.breakdown.cache_write += deltas.cache_write;
    this.persist();
    return { inserted: true, warnings: [] };
  }

  update(id, patch) {
    const r = this.byId.get(id);
    if (!r) return null;
    Object.assign(r, patch);
    this.persist();
    return r;
  }
}
