import { BotError, Context, GrammyError, HttpError } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys.constants";
import { createLogger } from "#/core/logging/logger.service";
import { reportSystemLog } from "#/core/logging/system-log.service";

const log = createLogger("error-handler");

export async function errorHandler(error: BotError<Context>) {
  const ctx = error.ctx;
  const e = error.error;
  const updateId = ctx.update.update_id;

  log.error(
    {
      err: e,
      updateId,
      chatId: ctx.chatId,
      userId: ctx.from?.id,
      updateType: Object.keys(ctx.update).find((key) => key !== "update_id"),
    },
    `Error while handling update ${updateId}`,
  );

  if (e instanceof GrammyError) {
    log.warn({ updateId, description: e.description }, "Telegram API error");

    // Specific case: bot doesn't have permission to send messages
    conditions: if (
      e.description.includes(
        "not enough rights to send text messages to the chat",
      ) &&
      ctx.chat?.type !== "private"
    ) {
      try {
        if (ctx.chat) {
          log.info({ chatId: ctx.chat.id }, "Leaving chat due to missing rights");
          await ctx.api.leaveChat(ctx.chat.id);
        }
      } catch (leaveErr) {
        log.error(
          { err: leaveErr, chatId: ctx.chat?.id },
          "Failed to leave chat",
        );
      }
    } else if (
      e.description.includes("message thread not found") &&
      ctx.chatId &&
      ctx.msg
    ) {
      const topicsData = await db
        .selectFrom("chatGameTopics")
        .selectAll()
        .where("chatId", "=", ctx.chatId.toString())
        .execute();
      const currentTopicId = ctx.msg.message_thread_id?.toString();
      if (!currentTopicId) break conditions;

      const topic = topicsData.find((t) => t.topicId === currentTopicId);
      if (!topic || !topic.shouldRecreateOnExpire) break conditions;

      const message = await ctx.api.sendMessage(
        ctx.chatId,
        "Recreating topic...",
      );
      try {
        const createdTopic = await ctx.createForumTopic(
          topic.name || "WordSeek",
          {
            icon_custom_emoji_id: topic.iconCustomEmojiId ?? undefined,
          },
        );
        await ctx.deleteForumTopic();
        await ctx.api.deleteMessage(ctx.chatId, message.message_id);
        await db
          .insertInto("chatGameTopics")
          .values({
            chatId: ctx.chatId.toString(),
            topicId: createdTopic.message_thread_id.toString(),
            iconCustomEmojiId: createdTopic.icon_custom_emoji_id,
            shouldRecreateOnExpire: true,
            allowedLengths: topic.allowedLengths,
            name: topic.name,
          })
          .execute();
        await db
          .deleteFrom("chatGameTopics")
          .where("chatId", "=", ctx.chatId.toString())
          .where("topicId", "=", currentTopicId)
          .execute();
        await redis.del(redisKeys.vote(ctx.chatId));

        await ctx.api.sendMessage(
          ctx.chatId,
          "Topic recreated successfully. You can now continue start playing in this topic.",
          {
            reply_parameters: { message_id: createdTopic.message_thread_id },
          },
        );
      } catch (recreateError) {
        log.error(
          { err: recreateError, chatId: ctx.chatId },
          "Failed to recreate forum topic",
        );
        await ctx.api.editMessageText(
          ctx.chatId,
          message.message_id,
          "I don't have enough rights to create and delete topics. Please update my permissions.",
        );
      }
    }
  } else if (e instanceof HttpError) {
    log.error({ err: e, updateId }, "Could not contact Telegram");

    await reportSystemLog("error", "Could not contact Telegram", {
      updateId,
      message: e.message,
    });
  } else {
    log.error({ err: e, updateId }, "Unhandled bot error");

    await reportSystemLog("error", "Unhandled bot error", {
      updateId,
      chatId: ctx.chatId,
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 6).join("\n") : undefined,
    });
  }
}
