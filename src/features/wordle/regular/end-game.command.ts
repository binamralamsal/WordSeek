import { Composer } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { escapeHtml } from "#/core/format/escape-html.helper";
import { runGuards } from "#/core/guards/admin.guard";
import { redisKeys } from "#/core/redis-keys.constants";

import { requireAllowedTopic } from "../shared/guards/wordle.guard";
import { endGame, getEndPermission } from "./services/end-game.service";

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

  await ctx.replyWithRichMessage(
    {
      html: `<h3>🗳️ Vote to End Game</h3>
<p><a href="tg://user?id=${ctx.from.id}">${escapeHtml(userName)}</a> wants to end the game.</p>
<table bordered compact>
<tr><td align="left">Votes needed</td><td align="right"><b>3</b></td></tr>
<tr><td align="left">Current votes</td><td align="right"><b>1/3</b></td></tr>
</table>
<p>Tap the button below to vote.</p>`,
    },
    {
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
