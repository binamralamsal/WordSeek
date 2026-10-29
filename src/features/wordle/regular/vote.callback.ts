import { Composer } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys.constants";

import { endGame, getEndPermission } from "./services/end-game.service";

const composer = new Composer();

composer.callbackQuery(/^vote_end\b/, async (ctx) => {
  const [, chatIdStr] = ctx.callbackQuery.data.split(" ");
  if (!chatIdStr) return ctx.answerCallbackQuery();

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
  const voteKey = redisKeys.vote(chatId);
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

  const permission = await getEndPermission(
    ctx,
    userId,
    existingGame.startedBy,
  );

  if (permission.permitted) {
    await ctx.deleteMessage();
    await endGame(ctx, chatId, existingGame.word, permission.reason);

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
});

export const voteEndCallback = composer;
