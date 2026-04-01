import { BotError, Context, GrammyError, HttpError } from "grammy";

import { db } from "../config/db";
import { redis } from "../config/redis";

export async function errorHandler(error: BotError<Context>) {
  const ctx = error.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = error.error;

  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);

    // Specific case: bot doesn't have permission to send messages
    conditions: if (
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
        await redis.del(`vote:${ctx.chatId}`);

        await ctx.api.sendMessage(
          ctx.chatId,
          "Topic recreated successfully. You can now continue start playing in this topic.",
          {
            reply_parameters: { message_id: createdTopic.message_thread_id },
          },
        );
      } catch {
        await ctx.api.editMessageText(
          ctx.chatId,
          message.message_id,
          "I don't have enough rights to create and delete topics. Please update my permissions.",
        );
      }
    }
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
}
