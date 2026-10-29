import pino from "pino";

import { env } from "#/config/env";

import { DailyFileStream } from "./daily-file.stream";

const targets: pino.StreamEntry[] = [
  {
    level: env.LOG_LEVEL as pino.Level,
    stream: process.stdout,
  },
];

if (env.LOG_TO_FILE && env.NODE_ENV !== "test") {
  targets.push({
    level: env.LOG_LEVEL as pino.Level,
    stream: new DailyFileStream(env.LOG_DIR, env.LOG_RETENTION_DAYS),
  });
}

/**
 * Root structured logger.
 *
 * Every entry is emitted as newline-delimited JSON to stdout (for container
 * log collection) and, outside of tests, appended to a daily file under
 * `LOG_DIR` (`wordseek-YYYY-MM-DD.log`).
 */
export const logger = pino(
  {
    level: env.LOG_LEVEL,
    base: { service: "wordseek" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  pino.multistream(targets),
);

export function createLogger(module: string): pino.Logger {
  return logger.child({ module });
}
