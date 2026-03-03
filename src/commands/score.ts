import { Composer } from "grammy";

import { getTargetUser } from "./seekauth";
import { CommandsHelper } from "../util/commands-helper";
import { getUserScores } from "../services/get-user-scores";
import { getSmartDefaults } from "../util/get-smart-defaults";
import { requireAllowedTopic, runGuards } from "../util/guards";
import { parseLeaderboardInput } from "../util/parse-leaderboard-input";
import { formatNoScoresMessage } from "../util/format-no-scores-message";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";

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
        message_id: ctx.msgId,
      },
    });
  }

  const message = formatUserScoreMessage(userScore, searchKey);
  ctx.reply(message, {
    disable_notification: true,
    parse_mode: "HTML",
    reply_markup: keyboard,
    reply_parameters: {
      message_id: ctx.msgId,
    },
    link_preview_options: {
      is_disabled: true,
    },
  });
});

CommandsHelper.addNewCommand(
  "score",
  "View score for a user (usage: /score [@username or user_id]).",
);

export const scoreCommand = composer;
