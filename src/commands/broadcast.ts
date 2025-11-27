import { Composer } from "grammy";

import { db } from "../config/db";
import { env } from "../config/env";
import { formatDuration } from "../util/format-duration";

const composer = new Composer();

composer.command("broadcast", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const { message } = ctx.update;
  const messageToForward = message?.reply_to_message?.message_id;

  if (!messageToForward || !message) {
    return ctx.reply(
      `<blockquote>No message to broadcast!</blockquote>

Please mention the message that you want to broadcast.`,
      { parse_mode: "HTML" },
    );
  }

  const chats = await db.selectFrom("broadcastChats").selectAll().execute();

  if (chats.length === 0) {
    return ctx.reply(
      `Not enough users are recorded yet!

<blockquote>Please try again later</blockquote>`,
      { parse_mode: "HTML" },
    );
  }

  const broadcastingMessage = await ctx.reply(
    `<blockquote>Broadcasting your message to ${chats.length} members</blockquote>`,
    { parse_mode: "HTML" },
  );

  let unknownErrorCount = 0;
  let blockedCount = 0;
  let successCount = 0;
  let deletedCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i];
    try {
      await ctx.api.copyMessage(
        Number(chat.id),
        message.chat.id,
        messageToForward,
      );
      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (
        errorMessage.includes("blocked") ||
        errorMessage.includes("bot was kicked")
      ) {
        blockedCount++;
      } else {
        unknownErrorCount++;
      }
      (async () => {
        try {
          await db
            .deleteFrom("broadcastChats")
            .where("id", "=", chat.id)
            .execute();
          deletedCount++;
        } catch (deleteError) {}
      })();
    }

    if ((i + 1) % 50 === 0) {
      const elapsed = Date.now() - startTime;
      const estimatedTotal = (elapsed / (i + 1)) * chats.length;
      const estimatedRemaining = estimatedTotal - elapsed;

      await ctx.api.editMessageText(
        broadcastingMessage.chat.id,
        broadcastingMessage.message_id,
        `<blockquote>Broadcast in progress!</blockquote>

Estimated time: <code>${formatDuration(estimatedRemaining)}</code>
Total Users: <code>${chats.length}</code>
Success: <code>${successCount}</code>
Blocked: <code>${blockedCount}</code>
Deleted: <code>${deletedCount}</code>`,
        { parse_mode: "HTML" },
      );

      await sleep(10_000);
    }
  }

  const totalTime = Date.now() - startTime;
  const totalFailed = blockedCount + unknownErrorCount;

  await ctx.api.editMessageText(
    broadcastingMessage.chat.id,
    broadcastingMessage.message_id,
    `<blockquote>Broadcast completed!</blockquote>

Completed in: <code>${formatDuration(totalTime)}</code>
Total Users: <code>${chats.length}</code>
Success: <code>${successCount}</code>
Blocked: <code>${blockedCount}</code>
Deleted: <code>${deletedCount}</code>
Total Failed: <code>${totalFailed}</code>`,
    { parse_mode: "HTML" },
  );
});

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const broadcastCommand = composer;
