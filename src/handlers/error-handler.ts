import { BotError, Context, GrammyError, HttpError } from "grammy";

export async function errorHandler(error: BotError<Context>) {
  const ctx = error.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = error.error;

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
}
