import { Composer, InlineKeyboard } from "grammy";

import { sql } from "kysely";

import { db } from "#/config/db";
import { editMessageTextSafe } from "#/core/telegram/edit-message.helper";

import {
  parseScoreCallback,
  parseScoreListCallback,
  parseScoreSelectCallback,
} from "./helpers/callback-data.helper";
import { formatNoScoresMessage } from "./helpers/format-no-scores-message.helper";
import { formatUserScoreMessage } from "./helpers/format-user-score-message.helper";
import { generateLeaderboardKeyboard } from "./helpers/leaderboard-keyboard.helper";
import { generateUserSelectionKeyboard } from "./helpers/user-selection-keyboard.helper";
import { getSmartDefaults } from "./services/get-smart-defaults.service";
import { getUserScores } from "./services/get-user-scores.service";

const composer = new Composer();

composer.callbackQuery(/^score_list/, async (ctx) => {
  const username = parseScoreListCallback(ctx.callbackQuery.data);

  if (!username) {
    return ctx.answerCallbackQuery();
  }

  const users = await db
    .selectFrom("users")
    .select(["id", "name", "username"])
    .where(sql`lower(username)`, "=", username)
    .execute();

  if (users.length === 0) {
    return ctx.answerCallbackQuery({
      text: "No users found with this username.",
      show_alert: true,
    });
  }

  const keyboard = generateUserSelectionKeyboard(users, username);

  await editMessageTextSafe(
    ctx,
    {
      html: `<h3>👥 Multiple Users Found</h3>
<blockquote>There are <b>${users.length}</b> users with username @${username}. This can happen when a user deletes their account and someone else creates a new account with the same username.</blockquote>
<p>Please select the user you want to view:</p>`,
    },
    {
      reply_markup: keyboard,
    },
  );

  return ctx.answerCallbackQuery();
});

composer.callbackQuery(/^score_select/, async (ctx) => {
  const parsed = parseScoreSelectCallback(ctx.callbackQuery.data);

  if (!parsed || !ctx.chat) {
    return ctx.answerCallbackQuery();
  }

  const { userId, username } = parsed;
  const chatId = ctx.chat.id.toString();

  const userInfo = await db
    .selectFrom("users")
    .select(["name"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!userInfo) {
    return ctx.answerCallbackQuery({
      text: "User not found.",
      show_alert: true,
    });
  }

  const { searchKey, timeKey, hasAnyScores, wordLength } =
    await getSmartDefaults({
      userId,
      chatId,
      requestedSearchKey: undefined,
      requestedTimeKey: undefined,
      chatType: ctx.chat.type,
    });

  const userScore = await getUserScores({
    chatId,
    userId,
    searchKey,
    timeKey,
  });

  if (!userScore) {
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
          wordLength,
          `score ${userId}`,
          username ? backButtonDetails : undefined,
        )
      : new InlineKeyboard().text(
          backButtonDetails.text,
          backButtonDetails.callback,
        );

    await editMessageTextSafe(
      ctx,
      { html: message },
      {
        reply_markup: keyboard,
      },
    );

    return ctx.answerCallbackQuery({
      text: "No scores found for the current filter.",
    });
  }

  const keyboard = generateLeaderboardKeyboard(
    searchKey,
    timeKey,
    wordLength,
    `score ${userId}`,
    username
      ? {
          text: "⬅️ Back to user list",
          callback: `score_list ${username}`,
        }
      : undefined,
  );

  await editMessageTextSafe(
    ctx,
    {
      html: formatUserScoreMessage(userScore, searchKey, timeKey, wordLength),
    },
    {
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    },
  );

  return ctx.answerCallbackQuery();
});

composer.callbackQuery(/^score /, async (ctx) => {
  const parsed = parseScoreCallback(ctx.callbackQuery.data);

  if (!parsed || !ctx.chat) {
    return ctx.answerCallbackQuery();
  }

  const { userId, searchKey, timeKey, wordLength } = parsed;
  const chatId = ctx.chat.id.toString();

  const userInfo = await db
    .selectFrom("users")
    .select(["name"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!userInfo) {
    return ctx.answerCallbackQuery({
      text: "User not found.",
      show_alert: true,
    });
  }

  let hasAnyScoresQuery = db
    .selectFrom("leaderboard")
    .select("userId")
    .where("userId", "=", userId)
    .limit(1);

  if (searchKey === "group") {
    hasAnyScoresQuery = hasAnyScoresQuery.where("chatId", "=", chatId);
  }

  const hasAnyScores = !!(await hasAnyScoresQuery.executeTakeFirst());

  const userScore = await getUserScores({
    chatId,
    userId,
    searchKey,
    timeKey,
    wordLength,
  });

  if (!userScore) {
    const message = formatNoScoresMessage({
      isOwnScore: userId === ctx.from?.id.toString(),
      userName: userInfo.name,
      searchKey,
      timeKey,
      wasTimeKeyExplicit: true,
      hasAnyScores,
    });

    const keyboard = generateLeaderboardKeyboard(
      searchKey,
      timeKey,
      wordLength,
      `score ${userId}`,
    );

    await editMessageTextSafe(
      ctx,
      { html: message },
      {
        reply_markup: keyboard,
      },
    );

    return ctx.answerCallbackQuery({
      text: "No scores found for this period.",
      show_alert: false,
    });
  }

  const keyboard = generateLeaderboardKeyboard(
    searchKey,
    timeKey,
    wordLength,
    `score ${userId}`,
  );

  await editMessageTextSafe(
    ctx,
    {
      html: formatUserScoreMessage(userScore, searchKey, timeKey, wordLength),
    },
    {
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    },
  );

  return ctx.answerCallbackQuery();
});

export const scoreCallbacks = composer;
