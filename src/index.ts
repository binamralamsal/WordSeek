import { autoRetry } from "@grammyjs/auto-retry";
import { run } from "@grammyjs/runner";

import { bot } from "#/config/bot";
import { CommandRegistry } from "#/core/services/command-registry.service";
import { createLogger } from "#/core/logging/logger.service";
import { errorHandler } from "#/core/middleware/error-handler.middleware";
import { createAppComposer } from "#/app";
import { dailyWordleCron } from "#/features/wordle/daily/daily.cron";
import { resumeBroadcast } from "#/features/admin/broadcast/broadcast.service";
import { startCaptchaWorker } from "#/features/admin/captcha/captcha-queue.service";
import { ensureDailyWordExists } from "#/features/wordle/daily/services/daily-word.service";

const log = createLogger("startup");

bot.api.config.use(autoRetry());
bot.use(createAppComposer());
bot.catch(errorHandler);

dailyWordleCron.start();
startCaptchaWorker();

await ensureDailyWordExists();
await bot.api.deleteWebhook({ drop_pending_updates: true });

// Resume any pending broadcast before starting the bot
run(bot);
log.info("Bot started");

await CommandRegistry.sync();
await resumeBroadcast();
