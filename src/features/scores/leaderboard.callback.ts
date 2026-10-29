import { Composer } from "grammy";

import { editMessageTextSafe } from "#/core/telegram/edit-message.helper";

import { parseLeaderboardCallback } from "./helpers/callback-data.helper";
import { getLeaderboardScores } from "./services/get-leaderboard-scores.service";
import { generateLeaderboardKeyboard } from "./helpers/leaderboard-keyboard.helper";
import { formatLeaderboardMessage } from "./helpers/format-leaderboard-message.helper";

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

  await editMessageTextSafe(
    ctx,
    formatLeaderboardMessage(memberScores, filter.searchKey),
    {
      reply_markup: keyboard,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    },
  );

  return ctx.answerCallbackQuery();
});

export const leaderboardCallbacks = composer;
