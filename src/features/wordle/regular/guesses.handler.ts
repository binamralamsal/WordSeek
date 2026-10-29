import type { Context } from "grammy";

import { db } from "#/config/db";
import type { WordLength } from "#/types";
import { runGuards } from "#/core/guards/admin.guard";

import { buildRichFeedback } from "../shared/helpers/board.helper";
import { requireAllowedTopic } from "../shared/guards/wordle.guard";
import { reactWithRandom } from "../shared/helpers/reactions.helper";
import { ALL_WORDS, MODE_LABEL } from "../shared/helpers/words.helper";

export async function handleRegularGuess(ctx: Context, currentGuess: string) {
  const chatId = ctx.chat!.id.toString();
  const userId = ctx.from!.id.toString();

  const currentTopicId = ctx.msg!.message_thread_id?.toString() || "general";

  const currentGame = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", ctx.chat!.id.toString())
    .where("topicId", "=", currentTopicId)
    .executeTakeFirst();

  if (!currentGame) return;

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return;

  const wordLength = currentGame.word.length as WordLength;
  const validWords = ALL_WORDS[wordLength];

  if (currentGuess.length !== wordLength) return;

  if (!validWords.includes(currentGuess))
    return ctx.reply(
      `${currentGuess} is not a valid ${wordLength}-letter word.`,
    );

  const guessExists = await db
    .selectFrom("guesses")
    .selectAll()
    .where("guess", "=", currentGuess)
    .where("chatId", "=", ctx.chat!.id.toString())
    .executeTakeFirst();

  if (guessExists)
    return ctx.reply(
      "Someone has already guessed your word. Please try another one!",
    );

  if (currentGuess === currentGame.word) {
    if (!ctx.from!.is_bot) {
      const allGuesses = await db
        .selectFrom("guesses")
        .selectAll()
        .where("gameId", "=", currentGame.id)
        .execute();

      const score = 30 - allGuesses.length;
      const additionalMessage = `Added ${30 - allGuesses.length} to the leaderboard.`;

      await db
        .insertInto("leaderboard")
        .values({
          score,
          chatId,
          userId,
          wordLength: wordLength.toString() as "4" | "5" | "6",
        })
        .execute();

      const formattedResponse = `<blockquote>Congrats! You guessed it correctly.\nCorrect Word: <b>${currentGuess}</b>\n${additionalMessage}</blockquote>\nStart with /new${wordLength}`;

      ctx.reply(formattedResponse, {
        reply_parameters: { message_id: ctx.message!.message_id },
        parse_mode: "HTML",
      });
    } else {
      const additionalMessage = `Anonymous admins or channels don't get points.`;

      const formattedResponse = `<blockquote>Congrats! You guessed it correctly.\nCorrect Word: <b>${currentGuess}</b>\n</blockquote>${additionalMessage}\nStart with /new${wordLength}`;

      ctx.reply(formattedResponse, {
        reply_parameters: { message_id: ctx.message!.message_id },
        parse_mode: "HTML",
      });
    }

    reactWithRandom(ctx);
    await db.deleteFrom("games").where("id", "=", currentGame.id).execute();
    return;
  }

  await db
    .insertInto("guesses")
    .values({
      gameId: currentGame.id,
      guess: currentGuess,
      chatId,
    })
    .execute();

  const allGuesses = await db
    .selectFrom("guesses")
    .selectAll()
    .where("gameId", "=", currentGame.id)
    .orderBy("createdAt", "asc")
    .execute();

  if (allGuesses.length === 30) {
    await db.deleteFrom("games").where("id", "=", currentGame.id).execute();
    return ctx.reply(
      "Game Over! The word was " +
        currentGame.word +
        `\nYou can start a new game with /new${wordLength}`,
    );
  }

  const modeLabel = MODE_LABEL[wordLength];

  await ctx.replyWithRichMessage({
    html: buildRichFeedback(allGuesses, currentGame.word, modeLabel),
  });
}
