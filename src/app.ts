import { Composer, type Context } from "grammy";

import { sequentialize } from "@grammyjs/runner";

import { commandRouter } from "#/features/command-router";
import { callbackRouter } from "#/features/callback-router";
import { wordleTextHandler } from "#/features/wordle/text.handler";
import { bannedUsersMiddleware } from "#/core/middleware/banned-users.middleware";
import { topicEditedMiddleware } from "#/core/middleware/topic-edited.middleware";
import { syncUserChatMiddleware } from "#/core/middleware/sync-user-chat.middleware";
import { botMembershipMiddleware } from "#/core/middleware/bot-membership.middleware";
import { trackMessagesMiddleware } from "#/core/middleware/track-messages.middleware";

/**
 * Builds the root middleware stack exactly as it is registered in production.
 *
 * Exposed separately from `index.ts` so tests can mount the real update
 * pipeline on a bot pointed at a fake Telegram API.
 */
export function createAppComposer(): Composer<Context> {
  const app = new Composer<Context>();

  app.use(syncUserChatMiddleware);
  app.use(topicEditedMiddleware);
  app.use(trackMessagesMiddleware);

  app.use(
    sequentialize((ctx) => {
      if (ctx.callbackQuery) return undefined;
      if (ctx.chat?.type === "private") return undefined;

      return ctx.chatId?.toString() || ctx.from?.id.toString();
    }),
  );

  app.use(bannedUsersMiddleware);

  app.use(commandRouter);
  app.use(callbackRouter);
  app.use(wordleTextHandler);
  app.use(botMembershipMiddleware);

  return app;
}
