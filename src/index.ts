import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";

import { bot } from "#/config/bot";
import { commands } from "#/features/commands";
import { callbacks } from "#/features/callbacks";
import { CommandRegistry } from "#/core/command-registry";
import { errorHandler } from "#/core/middleware/error-handler";
import { dailyWordleCron } from "#/features/wordle/daily/cron";
import { wordleTextHandler } from "#/features/wordle/text-handler";
import { resumeBroadcast } from "#/features/admin/broadcast/service";
import { bannedUsersMiddleware } from "#/core/middleware/banned-users";
import { topicEditedMiddleware } from "#/core/middleware/topic-edited";
import { syncUserChatMiddleware } from "#/core/middleware/sync-user-chat";
import { botMembershipMiddleware } from "#/core/middleware/bot-membership";
import { trackMessagesMiddleware } from "#/core/middleware/track-messages";
import { ensureDailyWordExists } from "#/features/wordle/daily/daily-word";

bot.api.config.use(autoRetry());
bot.use(syncUserChatMiddleware);
bot.use(topicEditedMiddleware);
bot.use(trackMessagesMiddleware);

bot.use(
  sequentialize((ctx) => {
    if (ctx.callbackQuery) return undefined;
    if (ctx.chat?.type === "private") return undefined;

    return ctx.chatId?.toString() || ctx.from?.id.toString();
  }),
);

bot.use(bannedUsersMiddleware);

bot.use(commands);
bot.use(callbacks);
bot.use(wordleTextHandler);
bot.use(botMembershipMiddleware);

bot.catch(errorHandler);
dailyWordleCron.start();
await ensureDailyWordExists();

await bot.api.deleteWebhook({ drop_pending_updates: true });

// Resume any pending broadcast before starting the bot
run(bot);
console.log("Bot started");

await CommandRegistry.sync();
await resumeBroadcast();
