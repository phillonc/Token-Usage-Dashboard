/* Pi telemetry → usage-collector exporter (drop into your Pi telemetry extension).
   Contract: POST canonical records to http://127.0.0.1:4600/api/ingest
   — single record or array. The collector validates R1/R7 and dedupes R4.

   This is the one source where you control the schema at origin: emit
   project and job properly here and these records arrive needing zero
   enrichment in the review queue.

   Fidelity decision (TRD open question #1):
   - If your extension captures token counts per run → fidelity "exact".
   - If it only counts runs/tool calls            → fidelity "activity".
   Pick ONE per fleet and stay consistent; the registry ceiling allows exact. */

const COLLECTOR = process.env.USAGE_COLLECTOR_URL ?? "http://127.0.0.1:4600";

export interface CanonicalUsageRecord {
  date: string;                    // ISO local date "YYYY-MM-DD"
  source: "pi_telemetry";
  tool: string;                    // e.g. "pi-agent"
  model?: string;                  // e.g. "claude-sonnet-4-6" if known per run
  project: string;
  job: string;                     // e.g. the run's task descriptor
  work_type: "coding" | "research" | "writing" | "ops" | "design" | "analysis" | "other";
  fidelity: "exact" | "activity";
  token_count?: number;            // exact lane only
  breakdown?: { input: number; output: number; cache_read: number; cache_write: number };
  activity_count?: number;         // activity lane only
  activity_unit?: "runs" | "tool_calls" | "sessions" | "messages";
  notes?: string;
}

export async function exportUsage(records: CanonicalUsageRecord | CanonicalUsageRecord[]): Promise<void> {
  try {
    const res = await fetch(`${COLLECTOR}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records),
    });
    const report = await res.json();
    if (report.rejected?.length) console.warn("[usage-export] rejected:", JSON.stringify(report.rejected));
    if (report.warnings?.length) console.warn("[usage-export] warnings:", report.warnings.join("; "));
  } catch (e) {
    // Collector down must never break an agent run — log and move on.
    console.warn(`[usage-export] collector unreachable (${(e as Error).message}) — record dropped; consider a local spool file`);
  }
}

/* Example wiring at the end of a run:

await exportUsage({
  date: new Date().toISOString().slice(0, 10),
  source: "pi_telemetry",
  tool: "pi-agent",
  model: run.model,
  project: run.workspace,
  job: run.taskTitle,
  work_type: "coding",
  fidelity: "exact",
  token_count: run.usage.total,
  breakdown: { input: run.usage.input, output: run.usage.output, cache_read: run.usage.cacheRead, cache_write: run.usage.cacheWrite },
});
*/
