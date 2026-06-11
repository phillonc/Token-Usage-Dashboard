import os from "node:os";
import path from "node:path";

const home = os.homedir();

export const CONFIG = {
  port: Number(process.env.PORT || 4600),

  // System of record + watcher cursors live here
  dataDir: process.env.DATA_DIR || path.resolve("data"),
  get logFile() { return path.join(this.dataDir, "usage-log.json"); },
  get cursorFile() { return path.join(this.dataDir, "cursors.json"); },

  // One intake door per source (see README — never two doors for the same source)
  watchers: {
    claude_code: {
      enabled: process.env.WATCH_CLAUDE_CODE !== "0",
      dir: process.env.CLAUDE_PROJECTS_DIR || path.join(home, ".claude", "projects"),
    },
    copilot_cli: {
      enabled: process.env.WATCH_COPILOT_CLI !== "0",
      dir: process.env.COPILOT_SESSION_DIR || path.join(process.env.COPILOT_HOME || path.join(home, ".copilot"), "session-state"),
    },
    // Stubs for week two — same watcher pattern, different parser (recipes in docs/):
    // codex_cli:   { enabled: false, dir: path.join(home, ".codex", "sessions") },
    // opencode_cli:{ enabled: false, dir: path.join(home, ".local/share/opencode/storage") },
  },
};
