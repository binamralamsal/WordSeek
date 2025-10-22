import { Composer } from "grammy";

import { DatabaseError } from "pg";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";
import { WordSelector } from "../util/word-selector";

const composer = new Composer();

composer.command("new", async (ctx) => {
  try {
    const chatId = ctx.chat.id;

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
