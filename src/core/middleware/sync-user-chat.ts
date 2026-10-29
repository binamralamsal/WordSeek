import { Composer } from "grammy";

import { upsertBroadcastChat, upsertUser } from "#/core/services/users";

const composer = new Composer();

composer.use(async (ctx, next) => {
  try {
    const user = ctx.from;
    const chat = ctx.chat;

    if (user && !user.is_bot) {
      const userId = user.id.toString();
      const userName =
        user.first_name + (user.last_name ? " " + user.last_name : "");
      const userUsername = user.username || null;

      // Sync without blocking the update pipeline.
      void upsertUser({
        id: userId,
        name: userName,
        username: userUsername,
      }).catch((error) => console.error("Error in user sync:", error));
    }

    if (chat && chat.type !== "channel") {
      const chatId = chat.id.toString();
      const chatName =
        chat.type === "private"
          ? user
            ? user.first_name + (user.last_name ? " " + user.last_name : "")
            : null
          : chat.title;
      const chatUsername = chat.username || null;

      void upsertBroadcastChat({
        id: chatId,
        name: chatName,
        username: chatUsername,
      }).catch((error) => console.error("Error in chat sync:", error));
    }
  } catch (error) {
    console.error("Error in sync middleware:", error);
  }

  return next();
});

export const syncUserChatMiddleware = composer;
