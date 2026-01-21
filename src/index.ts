import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";

import { commands } from "./commands";
import { bot } from "./config/bot";
import { db } from "./config/db";
import { callbackQueryHandler } from "./handlers/callback-query";
import { errorHandler } from "./handlers/error-handler";
import { onBotAddedInChat } from "./handlers/on-bot-added-in-chat";
import { onMessageHander } from "./handlers/on-message";
import { trackMessagesHandler } from "./handlers/track-messages-handler";
import { userAndChatSyncHandler } from "./handlers/user-and-chat-sync-handler";
import {
  dailyWordleCron,
  ensureDailyWordExists,
} from "./services/daily-wordle-cron";
import { CommandsHelper } from "./util/commands-helper";
import { getBroadcastState, performBroadcast } from "./commands/broadcast";

async function resumeBroadcast() {
  const state = await getBroadcastState();
  if (!state) return;

  console.log(`Resuming broadcast from index ${state.currentIndex}/${state.totalChats}`);

  const chats = await db.selectFrom("broadcastChats").selectAll().orderBy("broadcastChats.createdAt", "asc").execute();

  try {
    await bot.api.editMessageText(
      state.statusChatId,
      state.statusMessageId,
      `<blockquote>Broadcast resumed after restart!</blockquote>

Resuming from: <code>${state.currentIndex}/${state.totalChats}</code>
Total Users: <code>${state.totalChats}</code>
Success so far: <code>${state.successCount}</code>`,
      { parse_mode: "HTML" },
    );
  } catch (error) {
    console.error("Failed to update status message:", error);
  }

  await performBroadcast(chats, state);
  console.log("Broadcast resumed and completed successfully");
}

bot.api.config.use(autoRetry());
bot.use(userAndChatSyncHandler);
bot.use(trackMessagesHandler);

bot.use(
  sequentialize((ctx) => {
    if (ctx.callbackQuery) return undefined;

    return ctx.chatId?.toString() || ctx.from?.id.toString();
  }),
);

bot.use(commands);
bot.use(callbackQueryHandler);
bot.use(onMessageHander);
bot.use(onBotAddedInChat);

bot.catch(errorHandler);
dailyWordleCron.start();
await ensureDailyWordExists();

await bot.api.deleteWebhook({ drop_pending_updates: true });

// Resume any pending broadcast before starting the bot

run(bot);
console.log("Bot started");

await CommandsHelper.setCommands();
await resumeBroadcast();