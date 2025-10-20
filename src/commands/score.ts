import { Composer } from "grammy";

import { sql } from "kysely";

import { db } from "../config/db";
import { getUserScores } from "../services/get-user-scores";
import { CommandsHelper } from "../util/commands-helper";
import { formatNoScoresMessage } from "../util/format-no-scores-message";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { generateUserSelectionKeyboard } from "../util/generate-user-selection-keyboard";
import { getSmartDefaults } from "../util/get-smart-defaults";
import { parseLeaderboardInput } from "../util/parse-leaderboard-input";

const composer = new Composer();

composer.command("score", async (ctx) => {
  if (!ctx.from) return;
  const chatId = ctx.chat.id.toString();

  const input = ctx.match.trim();

  const {
    target,
    searchKey: requestedSearchKey,
    timeKey: requestedTimeKey,
  } = parseLeaderboardInput(input, undefined, null);

  let targetUserId: string | null = null;
  let targetUserName: string | undefined;
  const isOwnScore = !target;

  if (target) {
    // Check if it's a numeric user ID
    if (/^\d+$/.test(target)) {
      targetUserId = target;
    } else {
      const username = target.replace(/^@/, "");

      const users = await db
        .selectFrom("users")
        .select(["id", "name", "username"])
        .where(sql`lower(${"username"})`, "=", username)
        .execute();

      if (users.length === 0) {
        return ctx.reply(`No user found with username @${username}.`);
      }

      if (users.length > 1) {
        const keyboard = generateUserSelectionKeyboard(users, username);
        return ctx.reply(
          `⚠️ <strong>Multiple Users Found</strong>\n\n` +
            `There are ${users.length} users with username @${username}. ` +
            `This can happen when a user deletes their account and someone else creates a new account with the same username.\n\n` +
            `Please select the user you want to view:`,
          {
            parse_mode: "HTML",
            reply_markup: keyboard,
            reply_parameters: {
              message_id: ctx.msgId,
            },
          },
        );
      }

      targetUserId = users[0]!.id;
      targetUserName = users[0]!.name;
    }
  } else {
    targetUserId =
      ctx.message?.reply_to_message?.from?.id.toString() ||
      ctx.from.id.toString();
  }

  const userExists = await db
    .selectFrom("users")
    .select("name")
    .where("id", "=", targetUserId)
    .executeTakeFirst();

  if (!userExists) {
    return ctx.reply("User not found.");
  }

  if (!targetUserName) {
    targetUserName = userExists.name;
  }

  const { searchKey, timeKey, hasAnyScores } = await getSmartDefaults({
    userId: targetUserId,
    chatId,
    requestedSearchKey,
    requestedTimeKey,
    chatType: ctx.chat.type,
  });

  const keyboard = generateLeaderboardKeyboard(
    searchKey,
    timeKey,
    `score ${targetUserId}`,
  );

  const userScore = await getUserScores({
    userId: targetUserId,
    chatId,
    searchKey,
    timeKey,
  });

  if (!userScore) {
    const message = formatNoScoresMessage({
      isOwnScore,
      userName: targetUserName,
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
    reply_markup: keyboard,
    parse_mode: "HTML",
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
