import { Composer, Context } from "grammy";

import { db } from "../config/db";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { CommandsHelper } from "../util/commands-helper";
import { formatWordDetails } from "../util/format-word-details";

const composer = new Composer();

export async function isUserAuthorized(userId: string, chatId: string) {
  const authorized = await db
    .selectFrom("authorizedUsers")
    .where("userId", "=", userId)
    .where("chatId", "=", chatId)
    .executeTakeFirst();

  return !!authorized;
}

export async function endGame(
  ctx: Context,
  chatId: number,
  word: string,
  reason: string,
) {
  await db
    .deleteFrom("games")
    .where("activeChat", "=", String(chatId))
    .execute();

  await ctx.reply(
    `<blockquote>🎮 <b>Game Ended</b></blockquote>
${formatWordDetails(word)}
<blockquote>${reason}
Start a new game with /new</blockquote>`,
    { parse_mode: "HTML" },
  );
}

composer.command("end", async (ctx) => {
  const chatId = ctx.chat.id;
  if (!ctx.message) return;

  if (ctx.chat.is_forum) {
    const topicData = await db
      .selectFrom("chatGameTopics")
      .where("chatId", "=", chatId.toString())
      .selectAll()
      .execute();
    const topicIds = topicData.map((t) => t.topicId);
    const currentTopicId = ctx.msg.message_thread_id?.toString() || "general";

    if (topicData.length > 0 && !topicIds.includes(currentTopicId))
      return await ctx.reply(
        "This topic is not set for the game. Please play the game in the designated topic.",
      );
  }

  const currentGame = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", String(ctx.chat.id))
    .executeTakeFirst();

  if (!currentGame) return ctx.reply("There is no game in progress.");

  const userId = ctx.from.id.toString();
  const chatMember = await ctx.getChatMember(parseInt(userId));

  const isAdmin =
    chatMember.status === "administrator" || chatMember.status === "creator";
  const isSystemAdmin = env.ADMIN_USERS.includes(ctx.from.id);
  const isGameStarter = currentGame.startedBy === userId;
  const isAuthorized = await isUserAuthorized(userId, chatId.toString());
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

    return await endGame(ctx, chatId, currentGame.word, reason);
  }

  const voteKey = `vote:${chatId}`;
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

CommandsHelper.addNewCommand(
  "end",
  "End the current game. Available for only admins in groups.",
);

export const endGameCommand = composer;
