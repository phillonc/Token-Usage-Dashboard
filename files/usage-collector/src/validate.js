import { SOURCE_REGISTRY, FIDELITY_RANK } from "./registry.js";

/* Migrate v1-shaped records (tool_or_model) and fill derived fields. */
export function migrate(raw) {
  const r = { ...raw };
  if (!r.tool && r.tool_or_model) { r.tool = r.tool_or_model; delete r.tool_or_model; }
  if (!r.vendor && SOURCE_REGISTRY[r.source]) r.vendor = SOURCE_REGISTRY[r.source].vendor;
  if (!r.outcome) r.outcome = "pending";
  return r;
}

/* R1 + R7. Returns [] when valid. */
export function validateRecord(r) {
  const errs = [];
  if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errs.push("bad date (ISO YYYY-MM-DD)");
  if (!["exact", "activity", "estimate"].includes(r.fidelity)) errs.push("bad fidelity");

  const reg = SOURCE_REGISTRY[r.source];
  if (!reg) errs.push(`unknown source '${r.source}' — add it to the registry first`);
  else if (FIDELITY_RANK[r.fidelity] > FIDELITY_RANK[reg.max])
    errs.push(`R7: source '${r.source}' cannot support '${r.fidelity}' (ceiling: ${reg.max})`);

  const has = {
    exact: r.token_count != null && r.token_count !== "",
    activity: r.activity_count != null && r.activity_count !== "",
    estimate: !!r.estimate_band,
  };
  const populated = Object.entries(has).filter(([, v]) => v).map(([k]) => k);
  if (populated.length !== 1 || populated[0] !== r.fidelity)
    errs.push("R1: exactly one quantity field must be populated, matching fidelity");

  if (r.fidelity === "exact" && !(Number(r.token_count) >= 0)) errs.push("token_count must be a number >= 0");
  if (r.fidelity === "activity") {
    if (!(Number(r.activity_count) >= 0)) errs.push("activity_count must be a number >= 0");
    if (!r.activity_unit) errs.push("activity_unit required");
  }
  if (r.fidelity === "estimate" && !["B1", "B2", "B3", "B4"].includes(r.estimate_band))
    errs.push("estimate_band must be B1..B4");

  if (!r.tool) errs.push("tool required");
  return errs;
}

/* Whitelist for review-edit PUTs: humans own judgments, machines own quantities. */
export const REVIEW_FIELDS = ["outcome", "review_burden", "review_worth_it", "next_move", "notes", "project", "job", "work_type"];
