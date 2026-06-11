# Local LLMs (Ollama / LM Studio) → usage-collector

**Status: RECIPE** (middleware)
**Lane:** EXACT · `source: local_llm` · vendor local · R4 precedence 2

## Where the data lives
In the API responses, not in a log: Ollama returns `prompt_eval_count` / `eval_count` per generation; OpenAI-compatible local servers (LM Studio etc.) return a standard `usage` object. If your code doesn't capture it at call time, it's gone.

## Connector recipe
Wrap your client once — e.g. in the RAG pipeline's LLM adapter:
1. After each call, map `prompt_eval_count→input`, `eval_count→output` (no cache fields locally).
2. Buffer in memory and POST one record per model per day to `/api/ingest` on a timer or process exit (id `ll-<model>-<date>`, `accumulate`-style by re-POSTing daily totals is fine since insert-by-id skips existing — simplest correct approach: aggregate locally, POST once at end of day).

## Why bother when local is free
Cost isn't the only question the dashboard asks. Local runs still have review burden and outcomes, and "should this workload move between local and hosted?" is exactly a `change_model` next-move decision — you can only see the trade with both sides measured.

## Caveats
- Local tokenizers differ from hosted ones even for the "same" model family — the vendor-native rule covers this (vendor `local` is visible on every comparison).
- Embedding calls generate huge token counts that aren't comparable to chat usage; either tag them `work_type: ops` or exclude embeddings from export to keep the exact lane meaningful.
