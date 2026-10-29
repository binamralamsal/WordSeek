import { Composer } from "grammy";

import { runGuards } from "#/core/guards/admin.guard";
import { getTargetUser } from "#/core/services/users.service";
import { requireAllowedTopic } from "#/features/wordle/shared/guards/wordle.guard";

import { getUserScores } from "./services/get-user-scores.service";
import { parseLeaderboardInput } from "./helpers/parse-filters.helper";
import { getSmartDefaults } from "./services/get-smart-defaults.service";
import { formatNoScoresMessage } from "./helpers/format-no-scores-message.helper";
import { formatUserScoreMessage } from "./helpers/format-user-score-message.helper";
import { generateLeaderboardKeyboard } from "./helpers/leaderboard-keyboard.helper";

const composer = new Composer();

composer.command("score", async (ctx) => {
  if (!ctx.from) return;

  const chatId = ctx.chat.id.toString();

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return ctx.reply(guard.message);

  const input = ctx.match.trim();

  const {
    target,
    searchKey: requestedSearchKey,
    timeKey: requestedTimeKey,
    wordLength: requestedWordLength,
  } = parseLeaderboardInput(input, undefined, null);

  const isOwnScore = !target;

  const targetUser = await getTargetUser(ctx, target, true);

  if (!targetUser) {
    return ctx.reply("User not found.");
  }

  const targetUsername = targetUser.username || targetUser.name;

  const { searchKey, timeKey, wordLength, hasAnyScores } =
    await getSmartDefaults({
      userId: targetUser.id,
      chatId,
      requestedSearchKey,
      requestedTimeKey,
      requestedWordLength,
      chatType: ctx.chat.type,
    });

  const keyboard = generateLeaderboardKeyboard(
    searchKey,
    timeKey,
    wordLength,
    `score ${targetUser.id}`,
  );

  const userScore = await getUserScores({
    userId: targetUser.id,
    chatId,
    searchKey,
    timeKey,
    wordLength,
  });

  if (!userScore) {
    const message = formatNoScoresMessage({
      isOwnScore,
      userName: targetUsername,
      searchKey,
      timeKey,
      wasTimeKeyExplicit: !!requestedTimeKey,
      hasAnyScores,
    });

    return ctx.reply(message, {
      reply_markup: keyboard,
      reply_parameters: {
        message_id: ctx.msgId!,
      },
    });
  }

  const message = formatUserScoreMessage(userScore, searchKey);
  ctx.reply(message, {
    disable_notification: true,
    parse_mode: "HTML",
    reply_markup: keyboard,
    reply_parameters: {
      message_id: ctx.msgId!,
    },
    link_preview_options: {
      is_disabled: true,
    },
  });
});

export const scoreCommand = composer;
