import { Composer } from "grammy";

import { DatabaseError } from "pg";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";
import { regularGameGuards, runGuards } from "../util/guards";
import { type WordLength, WordSelector } from "../util/word-selector";

const composer = new Composer();

const VALID_WORD_LENGTHS: WordLength[] = [4, 5, 6];

composer.command("new", async (ctx) => {
  if (!ctx.from) return;

  try {
    const topicId = ctx.msg.message_thread_id?.toString() || "general";
    const chatId = ctx.chat.id;

    const lengthArg = ctx.match?.trim();

    if (
      lengthArg &&
      !VALID_WORD_LENGTHS.includes(Number(lengthArg) as WordLength)
    ) {
      return ctx.reply("Invalid word length. Use /new 4, /new 5, or /new 6.");
    }

    const wordLength: WordLength = lengthArg
      ? (Number(lengthArg) as WordLength)
      : 5;

    const guard = await runGuards(ctx, regularGameGuards);
    if (!guard.ok) return ctx.reply(guard.message);

    const wordSelector = new WordSelector();
    const randomWord = await wordSelector.getRandomWord(chatId, wordLength);

    await db
      .insertInto("games")
      .values({
        word: randomWord,
        activeChat: chatId.toString(),
        topicId,
        startedBy: ctx.msg.from?.id.toString(),
      })
      .execute();

    ctx.reply(`Game started! Guess the ${wordLength} letter word!`);
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

CommandsHelper.addNewCommand("new", "Start a new game. Usage: /new [4|5|6]");

export const newGameCommand = composer;
