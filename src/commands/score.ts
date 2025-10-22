import { Composer } from "grammy";

import { db } from "../config/db";
import { getUserScores } from "../services/get-user-scores";
import { CommandsHelper } from "../util/commands-helper";
import { formatNoScoresMessage } from "../util/format-no-scores-message";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { getSmartDefaults } from "../util/get-smart-defaults";
import { parseLeaderboardInput } from "../util/parse-leaderboard-input";
import { getTargetUser } from "./seekauth";

const composer = new Composer();

composer.command("score", async (ctx) => {
  if (!ctx.from) return;

  const chatId = ctx.chat.id.toString();

  if (ctx.chat.is_forum) {
    const topicData = await db
      .selectFrom("chatGameTopics")
      .where("chatId", "=", chatId.toString())
      .selectAll()
      .execute();
    const topicIds = topicData.map((t) => t.topicId);

    if (
      topicData.length > 0 &&
      !topicIds.includes(ctx.msg.message_thread_id?.toString() || "")
    )
      return await ctx.reply(
        "This topic is not set for the game. Please play the game in the designated topic.",
      );
  }

  const input = ctx.match.trim();

  const {
    target,
    searchKey: requestedSearchKey,
    timeKey: requestedTimeKey,
  } = parseLeaderboardInput(input, undefined, null);

  const isOwnScore = !target;

  const targetUser = await getTargetUser(ctx, target, true);

  if (!targetUser) {
    return ctx.reply("User not found.");
  }

  const targetUsername = targetUser.username || targetUser.name;

  const { searchKey, timeKey, hasAnyScores } = await getSmartDefaults({
    userId: targetUser.id,
    chatId,
    requestedSearchKey,
    requestedTimeKey,
    chatType: ctx.chat.type,
  });

  const keyboard = generateLeaderboardKeyboard(
    searchKey,
    timeKey,
    `score ${targetUser.id}`,
  );

  const userScore = await getUserScores({
    userId: targetUser.id,
    chatId,
    searchKey,
    timeKey,
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
