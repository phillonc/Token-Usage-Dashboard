import fs from "node:fs";
import path from "node:path";

/* Byte-offset cursors per watched file, persisted to disk, so a collector
   restart never re-ingests history. readNewLines() only returns complete
   lines — a partial trailing line (no newline yet) is left for next time. */

export class CursorStore {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.cursors = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  }

  persist() {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.cursors, null, 2));
    fs.renameSync(tmp, this.file);
  }

  readNewLines(filePath) {
    const start = this.cursors[filePath] || 0;
    const stat = fs.statSync(filePath);
    if (stat.size < start) this.cursors[filePath] = 0; // file truncated/rotated — start over
    const from = this.cursors[filePath] || 0;
    if (stat.size === from) return [];

    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(stat.size - from);
    fs.readSync(fd, buf, 0, buf.length, from);
    fs.closeSync(fd);

    const text = buf.toString("utf8");
    const lastNewline = text.lastIndexOf("\n");
    if (lastNewline === -1) return []; // only a partial line so far
    const complete = text.slice(0, lastNewline);
    this.cursors[filePath] = from + Buffer.byteLength(complete, "utf8") + 1;
    this.persist();
    return complete.split("\n").filter((l) => l.trim().length > 0);
  }
}
