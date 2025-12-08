import { Composer, InputFile } from "grammy";

import { db } from "../config/db";
import { redis } from "../config/redis";
import { generateWordleImage } from "../handlers/on-message";
import {
  ensureDailyWordExists,
  getCurrentGameDateString,
} from "../services/daily-wordle-cron";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("daily", async (ctx) => {
  if (!ctx.from) return;

  try {
    if (ctx.chat.type !== "private") {
      return ctx.reply(
        "WordSeek of the Day can only be played in private chat with the bot. Send me a message directly!",
      );
    }

    const userId = ctx.from.id.toString();

    const activeRegularGame = await db
      .selectFrom("games")
      .selectAll()
      .where("activeChat", "=", userId)
      .executeTakeFirst();

    if (activeRegularGame) {
      return ctx.reply(
        "⚠️ You have an active regular WordSeek game. Please complete or end that game with /end before starting WordSeek of the Day.",
      );
    }

    const gameDate = getCurrentGameDateString();
    const dailyWord = await ensureDailyWordExists(gameDate);

    if (!dailyWord) {
      return ctx.reply(
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
      const lastGuess = existingGuesses[existingGuesses.length - 1];

      if (lastGuess.guess === dailyWord.word) {
        return ctx.reply(
          `You've already completed today's WordSeek! You got it in ${existingGuesses.length} ${existingGuesses.length === 1 ? "try" : "tries"}. Come back after 6:00 AM tomorrow for a new challenge!`,
        );
      }

      if (existingGuesses.length >= 6) {
        return ctx.reply(
          `You've already used all 6 attempts for today's WordSeek. The word was: ${dailyWord.word.toUpperCase()}\n\nCome back after 6:00 AM tomorrow for a new challenge!`,
        );
      }
    }

    await redis.setex(
      `daily_wordle:${userId}`,
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

      return ctx.replyWithPhoto(new InputFile(imageBuffer), {
        caption: `Welcome back! You have ${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left for today's WordSeek. Keep guessing!`,
      });
    }

    return ctx.reply(
      "🎯 WordSeek of the Day started! Guess the 5-letter word. You have 6 attempts. Good luck!",
    );
  } catch (error) {
    console.error("Error starting daily wordle:", error);
    ctx.reply("Something went wrong. Please try again.");
  }
});

CommandsHelper.addNewCommand("daily", "Play WordSeek of the Day (DM only)");

composer.command("pausedaily", async (ctx) => {
  if (!ctx.from) return;

  try {
    const userId = ctx.from.id.toString();

    const dailyGameData = await redis.get(`daily_wordle:${userId}`);

    if (!dailyGameData) {
      return ctx.reply(
        "You don't have an active WordSeek of the Day game to pause.",
      );
    }

    await redis.del(`daily_wordle:${userId}`);

    return ctx.reply(
      "✅ Your WordSeek of the Day game has been paused. You can now play regular WordSeek.\n\nTo play today's WordSeek again, use /daily (your previous attempts will still count).",
    );
  } catch (error) {
    console.error("Error pausing daily wordle:", error);
    ctx.reply("Something went wrong. Please try again.");
  }
});

CommandsHelper.addNewCommand("pausedaily", "Pause WordSeek of the Day game");

export const dailyWordleCommand = composer;
