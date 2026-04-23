import { Composer, GrammyError, InlineKeyboard } from "grammy";

import { sql } from "kysely";

import { db } from "../config/db";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { captchaSchema } from "../schemas";
import { getUserScores } from "../services/get-user-scores";
import { getSmartDefaults } from "../util/get-smart-defaults";
import { endGame, isUserAuthorized } from "../commands/end-game";
import { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { formatNoScoresMessage } from "../util/format-no-scores-message";
import { getLeaderboardScores } from "../services/get-leaderboard-scores";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { formatLeaderboardMessage } from "../util/format-leaderboard-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { generateUserSelectionKeyboard } from "../util/generate-user-selection-keyboard";
import {
  buildCaptchaKeyboard,
  buildMessage,
  formatUserMention,
} from "../commands/captcha";
import {
  AllowedWordLength,
  SLOT_SYMBOLS,
  allowedChatSearchKeys,
  allowedChatTimeKeys,
  allowedWordLengths,
} from "../config/constants";
import {
  getAdminCommandsMessage,
  getGroupSettingsMessage,
  getHowToPlayMessage,
  getMainHelpKeyboard,
  getOtherCommandsMessage,
  getScoresMessage,
} from "../commands/help";

const composer = new Composer();

composer.on("callback_query:data", async (ctx) => {
  condition: if (ctx.callbackQuery.data.startsWith("leaderboard")) {
    const [, searchKey, timeKey, wordLength] =
      ctx.callbackQuery.data.split(" ");
    console.log(searchKey, timeKey, wordLength);
    if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
      break condition;
    if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
      break condition;
    if (!allowedWordLengths.includes(parseInt(wordLength) as AllowedWordLength))
      break condition;
    if (!ctx.chat) break condition;

    const chatId = ctx.chat.id.toString();
    const memberScores = await getLeaderboardScores({
      chatId,
      searchKey: searchKey as AllowedChatSearchKey,
      timeKey: timeKey as AllowedChatTimeKey,
      wordLength: parseInt(wordLength) as AllowedWordLength,
    });

    const keyboard = generateLeaderboardKeyboard(
      searchKey as AllowedChatSearchKey,
      timeKey as AllowedChatTimeKey,
      parseInt(wordLength) as AllowedWordLength,
    );

    await ctx
      .editMessageText(
        formatLeaderboardMessage(
          memberScores,
          searchKey as AllowedChatSearchKey,
        ),
        {
          reply_markup: keyboard,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        },
      )
      .catch(() => {});
  } else if (ctx.callbackQuery.data.startsWith("score_list")) {
    const parts = ctx.callbackQuery.data.split(" ");

    const [, username] = parts;
    if (!username) break condition;

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

        await ctx
          .editMessageText(message, {
            parse_mode: "HTML",
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
        wordLength,
        `score ${userId}`,
        username
          ? {
              text: "⬅️ Back to user list",
              callback: `score_list ${username}`,
            }
          : undefined,
      );

      await ctx
        .editMessageText(formatUserScoreMessage(userScore, searchKey), {
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
      const [, userId, searchKey, timeKey, wordLength] = parts;
      if (!allowedChatSearchKeys.includes(searchKey as AllowedChatSearchKey))
        break condition;
      if (!allowedChatTimeKeys.includes(timeKey as AllowedChatTimeKey))
        break condition;
      if (
        !allowedWordLengths.includes(parseInt(wordLength) as AllowedWordLength)
      )
        break condition;
      if (!ctx.chat) break condition;
      if (!userId) break condition;

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
        searchKey: searchKey as AllowedChatSearchKey,
        timeKey: timeKey as AllowedChatTimeKey,
        wordLength: parseInt(wordLength) as AllowedWordLength,
      });

      if (!userScore) {
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
          parseInt(wordLength) as AllowedWordLength,
          `score ${userId}`,
        );

        await ctx
          .editMessageText(message, {
            reply_markup: keyboard,
            parse_mode: "HTML",
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
        parseInt(wordLength) as AllowedWordLength,
        `score ${userId}`,
      );

      await ctx
        .editMessageText(
          formatUserScoreMessage(userScore, searchKey as AllowedChatSearchKey),
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
  } else if (ctx.callbackQuery.data.startsWith("vote_end")) {
    const [, chatIdStr] = ctx.callbackQuery.data.split(" ");
    if (!chatIdStr) return;

    const chatId = parseInt(chatIdStr);

    if (!ctx.chat || ctx.chat.id !== chatId) {
      return await ctx.answerCallbackQuery({
        text: "This vote is not for this chat.",
        show_alert: true,
      });
    }

    const existingGame = await db
      .selectFrom("games")
      .selectAll()
      .where("activeChat", "=", chatId.toString())
      .executeTakeFirst();

    if (!existingGame) {
      return await ctx.answerCallbackQuery({
        text: "No active game found.",
        show_alert: true,
      });
    }

    const userId = ctx.from.id.toString();
    const voteKey = `vote:${chatId}`;
    const voteDataStr = await redis.get(voteKey);

    if (!voteDataStr) {
      return await ctx.answerCallbackQuery({
        text: "The voting session has expired.",
        show_alert: true,
      });
    }

    const voteData = JSON.parse(voteDataStr);

    if (voteData.voters.includes(userId)) {
      return await ctx.answerCallbackQuery({
        text: "You have already voted.",
      });
    }

    const chatMember = await ctx.getChatMember(parseInt(userId));
    const isAdmin =
      chatMember.status === "administrator" || chatMember.status === "creator";
    const isSystemAdmin = env.ADMIN_USERS.includes(ctx.from.id);
    const isAuthorized = await isUserAuthorized(userId, chatId.toString());
    const isGameStarter = existingGame.startedBy === userId;
    const isPrivate = ctx.chat.type === "private";
    const isPermitted =
      isAdmin || isSystemAdmin || isGameStarter || isAuthorized || isPrivate;

    if (isPermitted) {
      const userName =
        ctx.from.first_name +
        (ctx.from.last_name ? " " + ctx.from.last_name : "");
      const userLink = `<a href="tg://user?id=${ctx.from.id}">${userName}</a>`;

      let reason = "";
      if (isPrivate) {
        reason = "";
      } else if (isGameStarter) {
        reason = `<b>Ended by game starter: </b>${userLink}`;
      } else if (isSystemAdmin) {
        reason = `<b>Ended by system administrator: </b>${userLink}`;
      } else if (isAdmin) {
        reason = `<b>Ended by group administrator: </b>${userLink}`;
      } else if (isAuthorized) {
        reason = `<b>Ended by authorized user: </b>${userLink}`;
      } else {
        reason = `<b>Ended by: </b>${userLink}`;
      }

      await ctx.deleteMessage();
      await endGame(ctx, chatId, existingGame.word, reason);

      return await ctx.answerCallbackQuery({
        text: "Game ended by admin/game starter! 🎯",
      });
    }

    voteData.voters.push(userId);

    if (voteData.voters.length >= 3) {
      await redis.del(voteKey);

      const reason = "<b>Game ended - 3 players voted to end the game</b>";
      await ctx.deleteMessage();
      await endGame(ctx, chatId, existingGame.word, reason);

      return await ctx.answerCallbackQuery({
        text: "Game ended! Voting threshold reached. 🎯",
      });
    }

    await redis.setex(voteKey, 300, JSON.stringify(voteData));

    const votesNeeded = 3 - voteData.voters.length;

    await ctx.editMessageText(
      `<b>🗳️ Vote to End Game</b>\n\n` +
        `Players are voting to end the game.\n\n` +
        `<b>Votes needed: 3 total</b>\n` +
        `<b>Current votes: ${voteData.voters.length}/3</b>\n\n` +
        `React with the button below to vote for ending the game.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `✅ Vote to End (${voteData.voters.length}/3)`,
                callback_data: `vote_end ${chatId}`,
              },
            ],
          ],
        },
        parse_mode: "HTML",
      },
    );

    await ctx.answerCallbackQuery({
      text: `Vote recorded! ${votesNeeded} more votes needed.`,
    });
  } else if (ctx.callbackQuery.data.startsWith("help_")) {
    type HelpSection = "howto" | "scores" | "group" | "other" | "admin";

    if (!ctx.from) {
      await ctx.answerCallbackQuery();
      return;
    }

    const shouldShowAdminCommands =
      env.ADMIN_USERS.includes(ctx.from.id) && ctx.chat?.type === "private";
    let message = "";
    let activeSection: HelpSection = "howto";

    switch (ctx.callbackQuery.data) {
      case "help_main":
      case "help_howto":
        message = getHowToPlayMessage();
        activeSection = "howto";
        break;
      case "help_scores":
        message = getScoresMessage();
        activeSection = "scores";
        break;
      case "help_group":
        message = getGroupSettingsMessage();
        activeSection = "group";
        break;
      case "help_other":
        message = getOtherCommandsMessage();
        activeSection = "other";
        break;
      case "help_admin":
        if (!shouldShowAdminCommands) {
          await ctx.answerCallbackQuery({
            text: "You don't have permission to view this.",
            show_alert: true,
          });
          return;
        }
        message = getAdminCommandsMessage();
        activeSection = "admin";
        break;
      default:
        await ctx.answerCallbackQuery();
        return;
    }

    const keyboard = getMainHelpKeyboard(
      shouldShowAdminCommands,
      activeSection,
    );

    const commonOptions = {
      parse_mode: "HTML" as const,
      reply_markup: keyboard,
    };

    try {
      await ctx.editMessageText(message, commonOptions);
    } catch (err) {
      if (
        err instanceof GrammyError &&
        !err.description.includes("message is not modified:")
      ) {
        await ctx.deleteMessage();
        await ctx.reply(message, commonOptions);
      }
    }

    await ctx.answerCallbackQuery();
  } else if (ctx.callbackQuery.data.startsWith("captcha_")) {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id.toString();
    const chatId = ctx.chat?.id.toString();
    const name = ctx.from.first_name;
    const username = ctx.from.username;

    if (!chatId) return;

    const key = `captcha:${chatId}:${userId}`;
    const raw = await redis.get(key);

    if (!raw) {
      return ctx.answerCallbackQuery({
        text: "Captcha expired or, this captcha isn't for you.",
        show_alert: true,
      });
    }

    const session = captchaSchema.parse(JSON.parse(raw));

    const mentionText = formatUserMention({
      id: userId,
      name,
      username,
    });

    if (data === "captcha_clear") {
      session.progress = [];
    } else if (data === "captcha_back") {
      session.progress.pop();
    }

    if (data.startsWith("captcha_pick")) {
      const emoji = data.split(" ")[1];

      if (session.progress.length < 3) {
        session.progress.push(emoji);
      }
    }
    const keyboard = buildCaptchaKeyboard(session.progress);

    if (session.progress.length === 3) {
      const success =
        JSON.stringify(session.progress) === JSON.stringify(session.answer);

      if (success) {
        await redis.del(key);

        await ctx.api.sendMessage(
          session.adminId,
          `✅ ${mentionText} passed the captcha.`,
          { parse_mode: "HTML" },
        );

        return ctx
          .editMessageText(
            buildMessage({
              mention: mentionText,
              progress: session.progress,
              attempts: session.attempts,
              maxAttempts: 3,
              status: "Verification successful ✅",
            }),
            { parse_mode: "HTML" },
          )
          .catch(() => {});
      }

      session.attempts += 1;

      if (session.attempts >= 3) {
        await redis.del(key);

        await ctx.api.sendMessage(
          session.adminId,
          `❌ ${mentionText} failed the captcha.\nExpected: ${session.answer.join(
            " ",
          )}\nGot: ${session.progress.join(" ")}`,
          { parse_mode: "HTML" },
        );

        return ctx
          .editMessageText(
            buildMessage({
              mention: mentionText,
              progress: session.answer,
              attempts: session.attempts,
              maxAttempts: 3,
              status: "Verification failed ❌",
            }),
            { parse_mode: "HTML" },
          )
          .catch(() => {});
      }

      session.progress = [];

      await redis.set(key, JSON.stringify(session), "KEEPTTL");

      return ctx
        .editMessageText(
          buildMessage({
            mention: mentionText,
            progress: [],
            attempts: session.attempts,
            maxAttempts: 3,
            status: "Incorrect selection. Try again.",
          }),
          {
            reply_markup: keyboard,
            parse_mode: "HTML",
          },
        )
        .catch(() => {});
    }

    await redis.set(key, JSON.stringify(session), "KEEPTTL");

    await ctx
      .editMessageText(
        buildMessage({
          mention: mentionText,
          progress: session.progress,
          attempts: session.attempts,
          maxAttempts: 3,
        }),
        {
          reply_markup: keyboard,
          parse_mode: "HTML",
        },
      )
      .catch(() => {});

    return ctx.answerCallbackQuery();
  }
});

export const callbackQueryHandler = composer;
