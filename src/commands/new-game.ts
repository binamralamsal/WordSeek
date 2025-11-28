import { Composer } from "grammy";

import { DatabaseError } from "pg";

import { db } from "../config/db";
import { redis } from "../config/redis";
import { dailyWordleSchema } from "../handlers/on-message";
import { CommandsHelper } from "../util/commands-helper";
import { WordSelector } from "../util/word-selector";

const composer = new Composer();

composer.command("new", async (ctx) => {
  if (!ctx.from) return;

  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id.toString();

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

    if (ctx.chat.type === "private") {
      const dailyGameData = await redis.get(`daily_wordle:${userId}`);
      const result = dailyWordleSchema.safeParse(
        JSON.parse(dailyGameData || "{}"),
      );
      if (result.success) {
        return ctx.reply(
          "⚠️ You have an active Wordle of the Day game in your private chat. Please pause it with /pausedaily before playing regular Wordle.",
        );
      }
    }

    const wordSelector = new WordSelector();
    const randomWord = await wordSelector.getRandomWord(chatId);

    await db
      .insertInto("games")
      .values({
        word: randomWord,
        activeChat: chatId.toString(),
        startedBy: ctx.msg.from?.id.toString(),
      })
      .execute();
    ctx.reply("Game started! Guess the 5 letter word!");
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "23505") {
      return ctx.reply(
        "There is already a game in progress in this chat. Use /end to end the current game.",
      );
    }

    console.error(error);
    ctx.reply("Something went wrong. Please try again.");
  }
});

CommandsHelper.addNewCommand("new", "Start a new game.");

export const newGameCommand = composer;
