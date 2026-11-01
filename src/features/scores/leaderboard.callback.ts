import { Composer } from "grammy";

import { editMessageTextSafe } from "#/core/telegram/edit-message.helper";
import { renderInlineKeyboard } from "#/core/telegram/rich-keyboard.helper";

import { parseLeaderboardCallback } from "./helpers/callback-data.helper";
import { formatLeaderboardMessage } from "./helpers/format-leaderboard-message.helper";
import { generateLeaderboardKeyboard } from "./helpers/leaderboard-keyboard.helper";
import { getLeaderboardScores } from "./services/get-leaderboard-scores.service";

const composer = new Composer();

composer.callbackQuery(/^leaderboard/, async (ctx) => {
  const filter = parseLeaderboardCallback(ctx.callbackQuery.data);

  if (!filter || !ctx.chat) {
    return ctx.answerCallbackQuery();
  }

  const chatId = ctx.chat.id.toString();
  const memberScores = await getLeaderboardScores({
    chatId,
    ...filter,
  });

  const keyboard = generateLeaderboardKeyboard(
    filter.searchKey,
    filter.timeKey,
    filter.wordLength,
  );

  const message = formatLeaderboardMessage(
    memberScores,
    filter.searchKey,
    filter.timeKey,
    filter.wordLength,
  );

  await editMessageTextSafe(ctx, {
    html: `${message}\n${renderInlineKeyboard(keyboard)}`,
  });

  return ctx.answerCallbackQuery();
});

export const leaderboardCallbacks = composer;
