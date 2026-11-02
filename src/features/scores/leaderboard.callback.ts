import { Composer } from "grammy";

import { env } from "#/config/env";
import { formatDisplayName } from "#/core/format/mention.helper";
import { editMessageTextSafe } from "#/core/telegram/edit-message.helper";
import { renderInlineKeyboard } from "#/core/telegram/rich-keyboard.helper";

import { parseLeaderboardCallback } from "./helpers/callback-data.helper";
import { formatLeaderboardMessage } from "./helpers/format-leaderboard-message.helper";
import { generateLeaderboardKeyboard } from "./helpers/leaderboard-keyboard.helper";
import { getLeaderboardView } from "./services/get-leaderboard-view.service";

const composer = new Composer();

composer.callbackQuery(/^leaderboard/, async (ctx) => {
  const filter = parseLeaderboardCallback(ctx.callbackQuery.data);

  if (!filter || !ctx.chat) {
    return ctx.answerCallbackQuery();
  }

  const chatId = ctx.chat.id.toString();
  const adminIds = new Set(env.ADMIN_USERS.map(String));
  const leaderboard = await getLeaderboardView({
    adminIds,
    chatId,
    requester: ctx.from
      ? {
          id: ctx.from.id.toString(),
          name: formatDisplayName(ctx.from),
          username: ctx.from.username ?? null,
        }
      : undefined,
    ...filter,
  });

  const keyboard = generateLeaderboardKeyboard(
    filter.searchKey,
    filter.timeKey,
    filter.wordLength,
  );

  const message = formatLeaderboardMessage(
    leaderboard.entries,
    filter.searchKey,
    filter.timeKey,
    filter.wordLength,
    {
      // Admins are identifiable in every leaderboard, including groups.
      revealIds: adminIds,
      currentUser: leaderboard.currentUser,
    },
  );

  await editMessageTextSafe(ctx, {
    html: `${message}\n${renderInlineKeyboard(keyboard)}`,
  });

  return ctx.answerCallbackQuery();
});

export const leaderboardCallbacks = composer;
