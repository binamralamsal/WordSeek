import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DailyFileStream } from "#/core/logging/daily-file.stream";

const directories: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wordseek-logs-"));
  directories.push(dir);
  return dir;
}

function writeLine(stream: DailyFileStream, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(`${line}\n`, (error) => (error ? reject(error) : resolve()));
  });
}

function closeStream(stream: DailyFileStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.end((error?: Error | null) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  for (const dir of directories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("DailyFileStream", () => {
  test("writes newline-delimited logs to a dated file", async () => {
    const dir = tempDir();
    const now = new Date("2025-06-01T10:00:00Z");
    const stream = new DailyFileStream(dir, 7, () => now);

    await writeLine(stream, '{"msg":"first"}');
    await writeLine(stream, '{"msg":"second"}');
    await closeStream(stream);

    const file = path.join(dir, "wordseek-2025-06-01.log");
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, "utf8")).toBe(
      '{"msg":"first"}\n{"msg":"second"}\n',
    );
  });

  test("rotates when the day changes", async () => {
    const dir = tempDir();
    let now = new Date("2025-06-01T10:00:00Z");
    const stream = new DailyFileStream(dir, 7, () => now);

    await writeLine(stream, "day one");
    now = new Date("2025-06-02T10:00:00Z");
    await writeLine(stream, "day two");
    await closeStream(stream);

    expect(
      fs.readFileSync(path.join(dir, "wordseek-2025-06-01.log"), "utf8"),
    ).toBe("day one\n");
    expect(
      fs.readFileSync(path.join(dir, "wordseek-2025-06-02.log"), "utf8"),
    ).toBe("day two\n");
  });

  test("prunes files older than the retention window", async () => {
    const dir = tempDir();
    const oldFile = path.join(dir, "wordseek-2025-01-01.log");
    fs.writeFileSync(oldFile, "old");
    const oldTime = new Date("2025-01-01T00:00:00Z");
    fs.utimesSync(oldFile, oldTime, oldTime);

    const stream = new DailyFileStream(
      dir,
      7,
      () => new Date("2025-06-01T10:00:00Z"),
    );
    await writeLine(stream, "fresh");
    await closeStream(stream);

    expect(fs.existsSync(oldFile)).toBe(false);
  });

  test("ignores unrelated files when pruning", async () => {
    const dir = tempDir();
    const unrelated = path.join(dir, "notes.txt");
    fs.writeFileSync(unrelated, "keep me");

    const stream = new DailyFileStream(
      dir,
      7,
      () => new Date("2025-06-01T10:00:00Z"),
    );
    await writeLine(stream, "line");
    await closeStream(stream);

    expect(fs.existsSync(unrelated)).toBe(true);
  });
});
