import { GrammyError, HttpError } from "grammy";

import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";

import { commands } from "./commands";
import { bot } from "./config/bot";
import { callbackQueryHandler } from "./handlers/callback-query";
import { onBotAddedInChat } from "./handlers/on-bot-added-in-chat";
import { onMessageHander } from "./handlers/on-message";
import { userSyncHandler } from "./handlers/user-sync-handler";
import { CommandsHelper } from "./util/commands-helper";

bot.api.config.use(autoRetry());
bot.use(userSyncHandler);

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

bot.catch(async (err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;

  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);

    // Specific case: bot doesn't have permission to send messages
    if (
      e.description.includes(
        "not enough rights to send text messages to the chat",
      ) &&
      ctx.chat?.type !== "private"
    ) {
      try {
        if (ctx.chat) {
          console.log(`Leaving chat ${ctx.chat.id} due to missing rights.`);
          await ctx.api.leaveChat(ctx.chat.id);
        }
      } catch (leaveErr) {
        console.error("Failed to leave chat:", leaveErr);
      }
    }
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// bot.start({
//   onStart: () => console.log("Bot started"),
//   drop_pending_updates: true,
// });
await bot.api.deleteWebhook({ drop_pending_updates: true });
run(bot);

console.log("Bot started");
await CommandsHelper.setCommands();
