/* SOURCE REGISTRY — the single authority on what each source can claim.
   max  = fidelity ceiling (R7): a record may be logged below it, never above it.
   prec = within-vendor precedence for exact-record dedupe (R4): higher wins. */

export const FIDELITY_RANK = { exact: 3, activity: 2, estimate: 1 };

export const SOURCE_REGISTRY = {
  anthropic_api: { vendor: "anthropic", max: "exact",    prec: 3, label: "Anthropic API / Console" },
  claude_code:   { vendor: "anthropic", max: "exact",    prec: 2, label: "Claude Code (JSONL/OTel)" },
  openai_api:    { vendor: "openai",    max: "exact",    prec: 3, label: "OpenAI API / Platform" },
  codex_cli:     { vendor: "openai",    max: "exact",    prec: 2, label: "Codex CLI (session logs)" },
  google_api:    { vendor: "google",    max: "exact",    prec: 3, label: "Google API / AI Studio" },
  gemini_cli:    { vendor: "google",    max: "exact",    prec: 2, label: "Gemini CLI (OTel//stats)" },
  copilot_cli:   { vendor: "github",    max: "exact",    prec: 2, label: "Copilot CLI (/usage, JSONL)" },
  copilot_ide:   { vendor: "github",    max: "activity", prec: 1, label: "Copilot IDE (requests only)" },
  opencode_cli:  { vendor: "multi",     max: "exact",    prec: 2, label: "OpenCode CLI (stats/export)" },
  aider:         { vendor: "multi",     max: "exact",    prec: 2, label: "Aider (token printout)" },
  cursor:        { vendor: "multi",     max: "activity", prec: 1, label: "Cursor (request counts)" },
  antigravity:   { vendor: "google",    max: "activity", prec: 1, label: "Antigravity (no token data)" },
  pi_telemetry:  { vendor: "multi",     max: "exact",    prec: 2, label: "Pi telemetry (exact if emitted)" },
  local_llm:     { vendor: "local",     max: "exact",    prec: 2, label: "Local LLM (Ollama/LM Studio)" },
  web_chat:      { vendor: "multi",     max: "activity", prec: 0, label: "Web chat (claude.ai/ChatGPT/Gemini)" },
  manual:        { vendor: "other",     max: "activity", prec: 0, label: "Manual notes" },
};
