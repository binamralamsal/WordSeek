import { Composer } from "grammy";

import { eq } from "drizzle-orm";

import { db } from "../drizzle/db";
import { usersTable } from "../drizzle/schema";
import { getUserScores } from "../services/get-user-scores";
import { CommandsHelper } from "../util/commands-helper";
import { lower } from "../util/drizzle-lower";
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
        .select({
          id: usersTable.telegramUserId,
          name: usersTable.name,
          username: usersTable.username,
        })
        .from(usersTable)
        .where(eq(lower(usersTable.username), username));

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
    targetUserId = ctx.from.id.toString();
  }

  const [userExists] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramUserId, targetUserId));

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

  const userScores = await getUserScores({
    userId: targetUserId,
    chatId,
    searchKey,
    timeKey,
  });

  if (!userScores) {
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

  const message = formatUserScoreMessage(userScores[0], searchKey);
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
