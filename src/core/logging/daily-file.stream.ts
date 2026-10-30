import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";

const FILE_PREFIX = "wordseek";
const FILE_EXTENSION = ".log";
const DAY_MS = 24 * 60 * 60 * 1000;

function dayStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Newline-delimited log file stream that rotates at UTC midnight and prunes
 * files older than the configured retention window.
 *
 * Keeping the rotation logic local (instead of relying on an external
 * transport) means it works the same under Bun, Node and during tests while
 * remaining synchronous to construct.
 */
export class DailyFileStream extends Writable {
  private currentDay: string | null = null;
  private currentStream: fs.WriteStream | null = null;

  constructor(
    private readonly directory: string,
    private readonly retentionDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    super({ decodeStrings: false });
  }

  private filePath(day: string): string {
    return path.join(this.directory, `${FILE_PREFIX}-${day}${FILE_EXTENSION}`);
  }

  private streamFor(now: Date): fs.WriteStream {
    const day = dayStamp(now);

    if (this.currentStream && this.currentDay === day) {
      return this.currentStream;
    }

    this.currentStream?.end();
    fs.mkdirSync(this.directory, { recursive: true });
    this.currentStream = fs.createWriteStream(this.filePath(day), {
      flags: "a",
    });
    this.currentDay = day;
    this.prune(now);

    return this.currentStream;
  }

  private prune(now: Date): void {
    if (this.retentionDays <= 0) return;

    const cutoff = now.getTime() - this.retentionDays * DAY_MS;

    for (const entry of fs.readdirSync(this.directory)) {
      if (
        !entry.startsWith(`${FILE_PREFIX}-`) ||
        !entry.endsWith(FILE_EXTENSION)
      ) {
        continue;
      }

      const fullPath = path.join(this.directory, entry);
      try {
        if (fs.statSync(fullPath).mtimeMs < cutoff) {
          fs.rmSync(fullPath, { force: true });
        }
      } catch {
        // A log file disappearing while pruning is not an application error.
      }
    }
  }

  override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    try {
      const stream = this.streamFor(this.now());
      stream.write(chunk as string | Uint8Array, callback);
    } catch (error) {
      callback(error as Error);
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    if (!this.currentStream) return callback();
    this.currentStream.end(callback);
  }
}
