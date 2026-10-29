import type { CommandContext, Context } from "grammy";

import { DatabaseError } from "pg";

import { db } from "#/config/db";
import { runGuards } from "#/core/guards/admin.guard";
import { createLogger } from "#/core/logging/logger.service";
import type { WordLength } from "#/types";

import { regularGameGuards } from "../../shared/guards/wordle.guard";
import { WordSelector } from "./word-selector.service";

const log = createLogger("features.wordle.regular.services.start-game.service");

const GLOBAL_VALID_LENGTHS: WordLength[] = [5, 4, 6];

export async function startGame(
  ctx: CommandContext<Context>,
  forcedLength?: WordLength,
) {
  if (!ctx.from || !ctx.chat) return;

  try {
    const topicId = ctx.msg.message_thread_id?.toString() || "general";
    const chatId = ctx.chat.id;

    const guard = await runGuards(ctx, regularGameGuards);
    if (!guard.ok) return ctx.reply(guard.message);

    const topicSettings = await db
      .selectFrom("chatGameTopics")
      .selectAll()
      .where("chatId", "=", chatId.toString())
      .where("topicId", "=", topicId)
      .executeTakeFirst();

    const allowedLengths: WordLength[] =
      (topicSettings?.allowedLengths as WordLength[]) ?? GLOBAL_VALID_LENGTHS;

    const defaultLength: WordLength = allowedLengths[0]!;

    let wordLength: WordLength;

    if (forcedLength) {
      if (!allowedLengths.includes(forcedLength)) {
        return ctx.reply(
          `Only these lengths are allowed in this topic: ${allowedLengths.join(
            ", ",
          )}.`,
        );
      }
      wordLength = forcedLength;
    } else {
      const lengthArg = ctx.match?.trim();

      if (lengthArg) {
        const parsed = Number(lengthArg) as WordLength;

        if (!allowedLengths.includes(parsed)) {
          return ctx.reply(
            `Only these lengths are allowed in this topic: ${allowedLengths.join(
              ", ",
            )}.`,
          );
        }

        wordLength = parsed;
      } else {
        wordLength = defaultLength;
      }
    }

    const wordSelector = new WordSelector();
    const randomWord = await wordSelector.getRandomWord(chatId, wordLength);

    await db
      .insertInto("games")
      .values({
        word: randomWord,
        activeChat: chatId.toString(),
        topicId,
        startedBy: ctx.from.id.toString(),
      })
      .execute();

    return ctx.reply(`Game started! Guess the ${wordLength}-letter word!`);
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "23505") {
      return ctx.reply(
        "There is already a game in progress in this chat. Use /end to end the current game.",
      );
    }

    log.error(error);
    return ctx.reply("Something went wrong. Please try again.");
  }
}
