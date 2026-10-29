import { Composer } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { runGuards } from "#/core/guards";
import { redisKeys } from "#/core/redis-keys";

import { requireAllowedTopic } from "../shared/guards";
import { endGame, getEndPermission } from "./end-game-service";

const composer = new Composer();

composer.command("end", async (ctx) => {
  const chatId = ctx.chat.id;
  if (!ctx.message) return;

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return ctx.reply(guard.message);

  const currentGame = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", String(ctx.chat.id))
    .executeTakeFirst();

  if (!currentGame) return ctx.reply("There is no game in progress.");

  const userId = ctx.from.id.toString();
  const permission = await getEndPermission(ctx, userId, currentGame.startedBy);

  if (permission.permitted) {
    return await endGame(ctx, chatId, currentGame.word, permission.reason);
  }

  const voteKey = redisKeys.vote(chatId);
  const existingVotes = await redis.get(voteKey);

  if (existingVotes) {
    return await ctx.reply(
      "⏳ A vote to end the game is already in progress. Please wait for it to complete.",
    );
  }

  const voteData = {
    voters: [userId],
    initiatedAt: Date.now(),
  };

  await redis.setex(voteKey, 300, JSON.stringify(voteData)); // 5 minutes expiry

  const userName =
    ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "");

  await ctx.reply(
    `<b>🗳️ Vote to End Game</b>\n\n` +
      `<a href="tg://user?id=${ctx.from.id}">${userName}</a> wants to end the game.\n\n` +
      `<b>Votes needed: 3 out of remaining players</b>\n` +
      `<b>Current votes: 1/3</b>\n\n` +
      `React with the button below to vote for ending the game.`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Vote to End (1/3)",
              callback_data: `vote_end ${chatId}`,
            },
          ],
        ],
      },
    },
  );
});

export const endGameCommand = composer;
