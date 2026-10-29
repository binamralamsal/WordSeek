import { Composer } from "grammy";

import { createLogger } from "#/core/logging/logger.service";
import { db } from "#/config/db";

const log = createLogger("core.middleware.topic-edited.middleware");

const composer = new Composer();

composer.on("message:forum_topic_edited", async (ctx) => {
  if (!ctx.chatId || !ctx.msg.message_thread_id) return;

  const details = ctx.msg.forum_topic_edited;

  const updates: { name?: string; iconCustomEmojiId?: string } = {};

  if (details.name) {
    updates.name = details.name;
  }

  if (details.icon_custom_emoji_id) {
    updates.iconCustomEmojiId = details.icon_custom_emoji_id;
  }

  if (Object.keys(updates).length === 0) return;

  const chatIdForQuery = ctx.chatId.toString();
  const topicIdForQuery = ctx.msg.message_thread_id.toString();

  try {
    await db
      .updateTable("chatGameTopics")
      .set(updates)
      .where("chatGameTopics.chatId", "=", chatIdForQuery)
      .where("topicId", "=", topicIdForQuery)
      .execute();
  } catch (err) {
    log.error(
      {
        chatId: chatIdForQuery,
        topicId: topicIdForQuery,
        updates,
        err,
      },
      "Failed updating chatGameTopics",
    );
  }
});

export const topicEditedMiddleware = composer;
