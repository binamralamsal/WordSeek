import { Composer } from "grammy";

import { runGuards } from "#/core/guards";
import { requireAllowedTopic } from "#/features/wordle/shared/guards";

import { parseLeaderboardFilters } from "./parse-filters";
import { generateLeaderboardKeyboard } from "./leaderboard-keyboard";
import { formatLeaderboardMessage } from "./format-leaderboard-message";
import { getLeaderboardScores } from "./services/get-leaderboard-scores";

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
