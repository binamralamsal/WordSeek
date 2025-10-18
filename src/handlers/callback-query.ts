import { Composer, InlineKeyboard } from "grammy";

import { and, eq } from "drizzle-orm";

import {
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "../config/constants";
import { db } from "../drizzle/db";
import { leaderboardTable, usersTable } from "../drizzle/schema";
import { getLeaderboardScores } from "../services/get-leaderboard-scores";
import { getUserScores } from "../services/get-user-scores";
import { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { lower } from "../util/drizzle-lower";
import { formatLeaderboardMessage } from "../util/format-leaderboard-message";
import { formatNoScoresMessage } from "../util/format-no-scores-message";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { generateUserSelectionKeyboard } from "../util/generate-user-selection-keyboard";
import { getSmartDefaults } from "../util/get-smart-defaults";

const composer = new Composer();

composer.on("callback_query:data", async (ctx) => {
  condition: if (ctx.callbackQuery.data.startsWith("leaderboard")) {
    const [, searchKey, timeKey] = ctx.callbackQuery.data.split(" ");
    if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
      break condition;
    if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
      break condition;
    if (!ctx.chat) break condition;

    const chatId = ctx.chat.id.toString();
    const memberScores = await getLeaderboardScores({
      chatId,
      searchKey: searchKey as AllowedChatSearchKey,
      timeKey: timeKey as AllowedChatTimeKey,
    });

    const keyboard = generateLeaderboardKeyboard(
      searchKey as AllowedChatSearchKey,
      timeKey as AllowedChatTimeKey,
    );

    await ctx
      .editMessageText(
        formatLeaderboardMessage(
          memberScores,
          searchKey as AllowedChatSearchKey,
          timeKey as AllowedChatTimeKey,
        ),
        {
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        },
      )
      .catch(() => {});
  } else if (ctx.callbackQuery.data.startsWith("score_list")) {
    const parts = ctx.callbackQuery.data.split(" ");

    const [, username] = parts;
    if (!username) break condition;

    const users = await db
      .select({
        id: usersTable.telegramUserId,
        name: usersTable.name,
        username: usersTable.username,
      })
      .from(usersTable)
      .where(eq(lower(usersTable.username), username));

    if (users.length === 0) {
      return ctx.answerCallbackQuery({
        text: "No users found with this username.",
        show_alert: true,
      });
    }

    const keyboard = generateUserSelectionKeyboard(users, username);

    await ctx
      .editMessageText(
        `⚠️ <strong>Multiple Users Found</strong>\n\n` +
          `There are ${users.length} users with username @${username}. ` +
          `This can happen when a user deletes their account and someone else creates a new account with the same username.\n\n` +
          `Please select the user you want to view:`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard,
        },
      )
      .catch(() => {});

    return await ctx.answerCallbackQuery();
  } else if (ctx.callbackQuery.data.startsWith("score")) {
    const parts = ctx.callbackQuery.data.split(" ");

    if (ctx.callbackQuery.data.startsWith("score_select")) {
      const [, userId, username] = parts;
      if (!userId) break condition;
      if (!ctx.chat) break condition;

      const chatId = ctx.chat.id.toString();

      const [userInfo] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.telegramUserId, userId));

      if (!userInfo) {
        return ctx.answerCallbackQuery({
          text: "User not found.",
          show_alert: true,
        });
      }

      const { searchKey, timeKey, hasAnyScores } = await getSmartDefaults({
        userId,
        chatId,
        requestedSearchKey: undefined,
        requestedTimeKey: undefined,
        chatType: ctx.chat.type,
      });

      const userScores = await getUserScores({
        chatId,
        userId,
        searchKey,
        timeKey,
      });

      if (!userScores || !userScores[0]) {
        const message = formatNoScoresMessage({
          isOwnScore: false,
          userName: userInfo.name,
          searchKey,
          timeKey,
          wasTimeKeyExplicit: false,
          hasAnyScores,
        });

        const backButtonDetails = {
          text: "⬅️ Back to user list",
          callback: `score_list ${username}`,
        };

        const keyboard = hasAnyScores
          ? generateLeaderboardKeyboard(
              searchKey,
              timeKey,
              `score ${userId}`,
              username ? backButtonDetails : undefined,
            )
          : new InlineKeyboard().text(
              backButtonDetails.text,
              backButtonDetails.callback,
            );

        await ctx
          .editMessageText(message, {
            reply_markup: keyboard,
          })
          .catch(() => {});

        return ctx.answerCallbackQuery({
          text: "No scores found for the current filter.",
        });
      }

      const keyboard = generateLeaderboardKeyboard(
        searchKey,
        timeKey,
        `score ${userId}`,
        username
          ? {
              text: "⬅️ Back to user list",
              callback: `score_list ${username}`,
            }
          : undefined,
      );

      await ctx
        .editMessageText(formatUserScoreMessage(userScores[0], searchKey), {
          reply_markup: keyboard,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {});

      return await ctx.answerCallbackQuery();
    }
    if (
      ctx.callbackQuery.data.startsWith("score ") &&
      !ctx.callbackQuery.data.startsWith("score_select") &&
      !ctx.callbackQuery.data.startsWith("score_list")
    ) {
      const [, userId, searchKey, timeKey] = parts;
      if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
        break condition;
      if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
        break condition;
      if (!ctx.chat) break condition;
      if (!userId) break condition;

      const chatId = ctx.chat.id.toString();

      const [userInfo] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.telegramUserId, userId));

      if (!userInfo) {
        return ctx.answerCallbackQuery({
          text: "User not found.",
          show_alert: true,
        });
      }

      const [hasAnyScoresQuery] = await db
        .select()
        .from(leaderboardTable)
        .innerJoin(usersTable, eq(leaderboardTable.userId, usersTable.id))
        .where(
          and(
            eq(usersTable.telegramUserId, userId),
            searchKey === "group"
              ? eq(leaderboardTable.chatId, chatId)
              : undefined,
          ),
        )
        .limit(1);

      const hasAnyScores = !!hasAnyScoresQuery;

      const userScores = await getUserScores({
        chatId,
        userId,
        searchKey: searchKey as AllowedChatSearchKey,
        timeKey: timeKey as AllowedChatTimeKey,
      });

      if (!userScores || !userScores[0]) {
        const message = formatNoScoresMessage({
          isOwnScore: userId === ctx.from?.id.toString(),
          userName: userInfo.name,
          searchKey: searchKey as AllowedChatSearchKey,
          timeKey: timeKey as AllowedChatTimeKey,
          wasTimeKeyExplicit: true,
          hasAnyScores,
        });

        const keyboard = generateLeaderboardKeyboard(
          searchKey as AllowedChatSearchKey,
          timeKey as AllowedChatTimeKey,
          `score ${userId}`,
        );

        await ctx
          .editMessageText(message, {
            reply_markup: keyboard,
          })
          .catch(() => {});

        return ctx.answerCallbackQuery({
          text: "No scores found for this period.",
          show_alert: false,
        });
      }

      const keyboard = generateLeaderboardKeyboard(
        searchKey as AllowedChatSearchKey,
        timeKey as AllowedChatTimeKey,
        `score ${userId}`,
      );

      await ctx
        .editMessageText(
          formatUserScoreMessage(
            userScores[0],
            searchKey as AllowedChatSearchKey,
          ),
          {
            reply_markup: keyboard,
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          },
        )
        .catch(() => {});

      return await ctx.answerCallbackQuery();
    }
    await ctx.answerCallbackQuery();
  }
});

export const callbackQueryHandler = composer;
