import type { Context } from "grammy";

import { db } from "#/config/db";
import { runGuards } from "#/core/guards/admin.guard";
import { replyNotice } from "#/core/telegram/reply-notice.helper";
import type { WordLength } from "#/types";

import { requireAllowedTopic } from "../shared/guards/wordle.guard";
import { buildRichFeedback } from "../shared/helpers/board.helper";
import { reactWithRandom } from "../shared/helpers/reactions.helper";
import { ALL_WORDS, MODE_LABEL } from "../shared/helpers/words.helper";
import { recordClassicResult } from "../shared/services/game-stats.service";

export async function handleRegularGuess(ctx: Context, currentGuess: string) {
  const chatId = ctx.chat!.id.toString();
  const userId = ctx.from!.id.toString();

  const currentTopicId = ctx.msg!.message_thread_id?.toString() || "general";

  const currentGame = await db
    .selectFrom("games")
    .selectAll()
    .where("source", "=", "telegram")
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
    return replyNotice(
      ctx,
      `${currentGuess} is not a valid ${wordLength}-letter word.`,
    );

  const guessExists = await db
    .selectFrom("guesses")
    .selectAll()
    .where("guess", "=", currentGuess)
    .where("chatId", "=", ctx.chat!.id.toString())
    .executeTakeFirst();

  if (guessExists)
    return replyNotice(
      ctx,
      "Someone has already guessed your word. Please try another one!",
    );

  if (currentGuess === currentGame.word) {
    if (!ctx.from!.is_bot) {
      const allGuesses = await db
        .selectFrom("guesses")
        .select("userId")
        .where("gameId", "=", currentGame.id)
        .execute();

      const score = 30 - allGuesses.length;
      const participants = new Set(
        allGuesses
          .map((row) => row.userId)
          .filter((id): id is string => Boolean(id)),
      );
      if (currentGame.startedBy) participants.add(currentGame.startedBy);
      participants.add(userId);

      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto("guesses")
          .values({
            gameId: currentGame.id,
            chatId,
            userId,
            guess: currentGuess,
          })
          .execute();

        for (const participant of participants) {
          await recordClassicResult(
            trx,
            participant,
            participant === userId ? "won" : "lost",
            participant === userId ? score : 0,
          );
        }

        await trx
          .insertInto("leaderboard")
          .values({
            score,
            chatId,
            userId,
            wordLength: wordLength.toString() as "4" | "5" | "6",
          })
          .execute();

        await trx
          .deleteFrom("games")
          .where("id", "=", currentGame.id)
          .execute();
      });

      const formattedResponse = `<h5>🎉 Congrats! You guessed it correctly</h5>
<p>The word was <b>${currentGuess.toUpperCase()}</b>.</p>
<blockquote>Added ${score} to the leaderboard.</blockquote>
<p>Keep the streak going with /new${wordLength}</p>`;

      ctx.replyWithRichMessage(
        { html: formattedResponse },
        {
          reply_parameters: { message_id: ctx.message!.message_id },
        },
      );
    } else {
      const allGuesses = await db
        .selectFrom("guesses")
        .select("userId")
        .where("gameId", "=", currentGame.id)
        .execute();
      const participants = new Set(
        allGuesses
          .map((row) => row.userId)
          .filter((id): id is string => Boolean(id)),
      );
      if (currentGame.startedBy) participants.add(currentGame.startedBy);

      await db.transaction().execute(async (trx) => {
        for (const participant of participants) {
          await recordClassicResult(trx, participant, "lost", 0);
        }
        await trx
          .deleteFrom("games")
          .where("id", "=", currentGame.id)
          .execute();
      });

      const additionalMessage = `Anonymous admins or channels don't get points.`;

      const formattedResponse = `<h5>🎉 Congrats! You guessed it correctly</h5>
<p>The word was <b>${currentGuess.toUpperCase()}</b>.</p>
<blockquote>${additionalMessage}</blockquote>
<p>Start with /new${wordLength}</p>`;

      ctx.replyWithRichMessage(
        { html: formattedResponse },
        {
          reply_parameters: { message_id: ctx.message!.message_id },
        },
      );
    }

    reactWithRandom(ctx);
    return;
  }

  await db
    .insertInto("guesses")
    .values({
      gameId: currentGame.id,
      guess: currentGuess,
      chatId,
      userId,
    })
    .execute();

  const allGuesses = await db
    .selectFrom("guesses")
    .selectAll()
    .where("gameId", "=", currentGame.id)
    .orderBy("createdAt", "asc")
    .execute();

  if (allGuesses.length === 30) {
    const participants = new Set(
      allGuesses
        .map((row) => row.userId)
        .filter((id): id is string => Boolean(id)),
    );
    if (currentGame.startedBy) participants.add(currentGame.startedBy);

    await db.transaction().execute(async (trx) => {
      for (const participant of participants) {
        await recordClassicResult(trx, participant, "lost", 0);
      }
      await trx.deleteFrom("games").where("id", "=", currentGame.id).execute();
    });
    return ctx.replyWithRichMessage({
      html: `<h5>🛑 Game Over!</h5>
<p>The word was <b>${currentGame.word.toUpperCase()}</b>.</p>
<p>You can start a new game with /new${wordLength}</p>`,
    });
  }

  const modeLabel = MODE_LABEL[wordLength];

  await ctx.replyWithRichMessage({
    html: buildRichFeedback(
      allGuesses.map(({ id, guess, gameId, createdAt, updatedAt }) => ({
        id,
        guess,
        gameId: gameId ?? undefined,
        createdAt,
        updatedAt,
      })),
      currentGame.word,
      modeLabel,
    ),
  });
}
