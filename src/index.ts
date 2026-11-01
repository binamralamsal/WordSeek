import { autoRetry } from "@grammyjs/auto-retry";
import { run, type RunnerHandle } from "@grammyjs/runner";

import { createAppComposer } from "#/app";
import { bot } from "#/config/bot";
import { closeDatabase } from "#/config/db";
import { env } from "#/config/env";
import { closeRedis } from "#/config/redis";
import { createLogger } from "#/core/logging/logger.service";
import { errorHandler } from "#/core/middleware/error-handler.middleware";
import { CommandRegistry } from "#/core/services/command-registry.service";
import {
  acquireInstanceLock,
  releaseInstanceLock,
} from "#/core/services/instance-lock.service";
import { resumeBroadcast } from "#/features/admin/broadcast/broadcast.service";
import {
  closeCaptchaQueue,
  startCaptchaWorker,
} from "#/features/admin/captcha/captcha-queue.service";
import { leaderboardCompactionCron } from "#/features/scores/leaderboard-compaction.cron";
import { dailyWordleCron } from "#/features/wordle/daily/daily.cron";
import { ensureDailyWordExists } from "#/features/wordle/daily/services/daily-word.service";

const log = createLogger("startup");

const SHUTDOWN_TIMEOUT_MS = 10_000;

let runner: RunnerHandle | null = null;
let shuttingDown = false;

bot.api.config.use(autoRetry());
bot.use(createAppComposer());
bot.catch(errorHandler);

async function start(): Promise<void> {
  // The lock protects production replicas from double-polling. In development
  // `bun --watch` may kill the process before it can release the lock, which
  // would block the next start until the 30 s TTL expires, so skip it there.
  if (env.NODE_ENV === "production") {
    const locked = await acquireInstanceLock({
      onLost: () => void shutdown("instance lock lost", 1),
    });

    if (!locked) {
      throw new Error(
        "Another WordSeek instance is already running (Redis lock is held)",
      );
    }
  } else {
    log.info("Instance lock disabled outside production");
  }

  dailyWordleCron.start();
  leaderboardCompactionCron.start();
  startCaptchaWorker();

  // `ensureDailyWordExists` logs and returns null on failure, so a transient
  // database/API error does not block startup; the daily cron retries later.
  await ensureDailyWordExists();
  await bot.api.deleteWebhook({ drop_pending_updates: true });

  // Resume any pending broadcast before starting the bot
  runner = run(bot);
  log.info("Bot started");

  await CommandRegistry.sync();
  await resumeBroadcast();
}

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  log.info({ reason }, "Shutting down");

  const forceExit = setTimeout(() => {
    log.error({ reason }, "Graceful shutdown timed out, exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref?.();

  try {
    await runner?.stop();
    dailyWordleCron.stop();
    leaderboardCompactionCron.stop();
    await closeCaptchaQueue();
    await releaseInstanceLock();
    await closeDatabase();
    await closeRedis();

    clearTimeout(forceExit);
    log.info("Shutdown complete");
    process.exit(exitCode);
  } catch (error) {
    log.error({ err: error }, "Shutdown failed");
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await start();
} catch (error) {
  log.error({ err: error }, "Startup failed");
  await shutdown("startup failure", 1);
}
