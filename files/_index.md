# Connector index

| Integration | Status | Lane | Doc |
|---|---|---|---|
| Claude Code | **BUILT** (default on) | exact | claude-code.md |
| Copilot CLI | **BUILT** (default on) | exact + premium-request activity | copilot-cli.md |
| Codex CLI | recipe | exact | codex-cli.md |
| Gemini CLI | recipe (enable telemetry first) | exact | gemini-cli.md |
| OpenCode | recipe (scheduled pull recommended) | exact | opencode.md |
| Aider | recipe (lightweight) | exact | aider.md |
| Pi agents | contract provided (`examples/pi-exporter.ts`) | exact OR activity — decide once | pi-telemetry.md |
| Antigravity | no integration possible (activity ceiling, R7-enforced) | activity | antigravity.md |
| Anthropic API/Console | recipe (daily pull, precedence 3) | exact | anthropic-api.md |
| Local LLMs | recipe (client middleware) | exact | local-llm.md |

Rules that apply to every connector: ONE door per source (never watcher + OTel for the same tool) · machines write quantities, humans write judgments (PUT whitelist) · deterministic ids make every connector idempotent · fidelity ceilings are enforced at ingest (R7), supersession at overlap (R4).
