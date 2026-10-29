import { Composer } from "grammy";

import { runGuards } from "#/core/guards/admin.guard";
import { requireAllowedTopic } from "#/features/wordle/shared/guards/wordle.guard";

import { formatLeaderboardMessage } from "./helpers/format-leaderboard-message.helper";
import { generateLeaderboardKeyboard } from "./helpers/leaderboard-keyboard.helper";
import { parseLeaderboardFilters } from "./helpers/parse-filters.helper";
import { getLeaderboardScores } from "./services/get-leaderboard-scores.service";

const composer = new Composer();

composer.command("leaderboard", async (ctx) => {
  const chatId = ctx.chat.id.toString();

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return ctx.reply(guard.message);

  const { searchKey, timeKey, wordLength } = parseLeaderboardFilters(
    ctx.match,
    ctx.chat.type === "private" ? "global" : undefined,
  );

  const keyboard = generateLeaderboardKeyboard(searchKey, timeKey, wordLength);

  const memberScores = await getLeaderboardScores({
    chatId,
    searchKey,
    timeKey,
    wordLength,
  });

  ctx.reply(formatLeaderboardMessage(memberScores, searchKey), {
    disable_notification: true,
    reply_markup: keyboard,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
});

export const leaderboardCommand = composer;
