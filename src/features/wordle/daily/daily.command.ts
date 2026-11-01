import { Composer } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { runGuards } from "#/core/guards/admin.guard";
import { createLogger } from "#/core/logging/logger.service";
import { redisKeys } from "#/core/redis-keys.constants";
import { replyNotice } from "#/core/telegram/reply-notice.helper";

import { dailyGameGuards } from "../shared/guards/wordle.guard";
import { sendBoardMessage } from "../shared/helpers/board-message.helper";
import { generateWordleImage } from "../shared/helpers/image.helper";
import { getCurrentGameDateString } from "./helpers/date.helper";
import { ensureDailyWordExists } from "./services/daily-word.service";

const log = createLogger("features.wordle.daily.daily.command");

const composer = new Composer();

composer.command("daily", async (ctx) => {
  if (!ctx.from) return;

  try {
    const guard = await runGuards(ctx, dailyGameGuards);
    if (!guard.ok) return replyNotice(ctx, guard.message);

    const userId = ctx.from.id.toString();

    const gameDate = getCurrentGameDateString();
    const dailyWord = await ensureDailyWordExists(gameDate);

    if (!dailyWord) {
      return replyNotice(
        ctx,
        "Today's WordSeek is not ready yet due to a server issue. Please try again in a few moments!",
      );
    }

    await db
      .insertInto("userStats")
      .values({
        userId,
        highestStreak: 0,
        currentStreak: 0,
        lastGuessed: null,
      })
      .onConflict((oc) => oc.column("userId").doNothing())
      .execute();

    const existingGuesses = await db
      .selectFrom("dailyGuesses")
      .selectAll()
      .where("userId", "=", userId)
      .where("dailyWordId", "=", dailyWord.id)
      .execute();

    if (existingGuesses.length > 0) {
      const lastGuess = existingGuesses[existingGuesses.length - 1]!;

      if (lastGuess.guess === dailyWord.word) {
        const tries = existingGuesses.length === 1 ? "try" : "tries";

        return ctx.replyWithRichMessage({
          html: `<h5>✅ Daily Already Solved</h5>
<p>You solved today's WordSeek in <b>${existingGuesses.length}</b> ${tries}.</p>
<footer>Come back after 6:00 AM tomorrow for a new challenge!</footer>`,
        });
      }

      if (existingGuesses.length >= 6) {
        return ctx.replyWithRichMessage({
          html: `<h5>💭 Out of Attempts</h5>
<p>The word was <b>${dailyWord.word.toUpperCase()}</b>.</p>
<footer>Come back after 6:00 AM tomorrow for a new challenge!</footer>`,
        });
      }
    }

    await redis.setex(
      redisKeys.dailySession(userId),
      86400,
      JSON.stringify({
        dailyWordId: dailyWord.id,
        date: gameDate,
        startedAt: new Date().toISOString(),
      }),
    );

    const attemptsUsed = existingGuesses.length;
    const attemptsLeft = 6 - attemptsUsed;

    if (attemptsUsed > 0) {
      const imageBuffer = await generateWordleImage(
        existingGuesses,
        dailyWord.word,
      );
      const attemptsLabel = attemptsLeft === 1 ? "attempt" : "attempts";

      return sendBoardMessage(
        ctx,
        imageBuffer,
        `<p>Welcome back! You have <b>${attemptsLeft}</b> ${attemptsLabel} left today.</p>
<p>Keep guessing!</p>`,
        {
          caption: `Welcome back! You have ${attemptsLeft} ${attemptsLabel} left for today's WordSeek. Keep guessing!`,
        },
      );
    }

    return ctx.replyWithRichMessage({
      html: `<h5>🎯 WordSeek of the Day</h5>
<p>Guess the <b>5-letter</b> word. You have <b>6</b> attempts.</p>`,
    });
  } catch (error) {
    log.error({ err: error }, "Error starting daily wordle:");
    replyNotice(ctx, "Something went wrong. Please try again.");
  }
});

composer.command("pausedaily", async (ctx) => {
  if (!ctx.from) return;

  try {
    const userId = ctx.from.id.toString();

    const dailyGameData = await redis.get(redisKeys.dailySession(userId));

    if (!dailyGameData) {
      return replyNotice(
        ctx,
        "You don't have an active WordSeek of the Day game to pause.",
      );
    }

    await redis.del(redisKeys.dailySession(userId));

    return ctx.replyWithRichMessage({
      html: `<h5>⏸️ Daily Game Paused</h5>
<p>You can now play regular WordSeek.</p>
<footer>Use /daily to resume today's puzzle — previous attempts still count.</footer>`,
    });
  } catch (error) {
    log.error({ err: error }, "Error pausing daily wordle:");
    replyNotice(ctx, "Something went wrong. Please try again.");
  }
});

export const dailyWordleCommand = composer;
