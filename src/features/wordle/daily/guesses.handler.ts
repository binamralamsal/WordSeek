import type { Context } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys.constants";
import { formatDailyWordDetails } from "#/core/format/word-details.helper";

import { ALL_WORDS } from "../shared/helpers/words.helper";
import { evaluateGuess } from "../shared/helpers/board.helper";
import { getCurrentGameDateString } from "./helpers/date.helper";
import { reactWithRandom } from "../shared/helpers/reactions.helper";
import { recordWinStreak, resetStreak } from "./services/streaks.service";
import type { DailyWord, GuessEntry } from "../shared/types";
import { generateWordleImage, wordleImageFile } from "../shared/helpers/image.helper";

const DAILY_ATTEMPTS = 6;

export async function handleDailyWordleGuess(
  ctx: Context,
  currentGuess: string,
) {
  const userId = ctx.from!.id.toString();

  if (!ALL_WORDS[5].includes(currentGuess)) {
    return ctx.reply(`${currentGuess.toUpperCase()} is not a valid word.`);
  }

  const todayDate = getCurrentGameDateString();

  const dailyWord = await db
    .selectFrom("dailyWords")
    .selectAll()
    .where("date", "=", new Date(todayDate))
    .executeTakeFirst();

  if (!dailyWord) {
    return ctx.reply(
      "Today's WordSeek is not available. Please try again later.",
    );
  }

  const existingGuesses = await db
    .selectFrom("dailyGuesses")
    .selectAll()
    .where("userId", "=", userId)
    .where("dailyWordId", "=", dailyWord.id)
    .orderBy("attemptNumber", "asc")
    .execute();

  if (existingGuesses.some((g) => g.guess === currentGuess)) {
    return ctx.reply("You've already guessed this word. Try a different one!");
  }

  const attemptNumber = existingGuesses.length + 1;
  await db
    .insertInto("dailyGuesses")
    .values({
      userId,
      dailyWordId: dailyWord.id,
      guess: currentGuess,
      attemptNumber,
    })
    .execute();

  const allGuesses = await db
    .selectFrom("dailyGuesses")
    .selectAll()
    .where("userId", "=", userId)
    .where("dailyWordId", "=", dailyWord.id)
    .orderBy("attemptNumber", "asc")
    .execute();

  if (currentGuess === dailyWord.word) {
    await handleDailyWordleWin(ctx, dailyWord, allGuesses);
    return;
  }

  if (allGuesses.length >= DAILY_ATTEMPTS) {
    await handleDailyWordleLoss(ctx, dailyWord, allGuesses);
    return;
  }

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const attemptsLeft = DAILY_ATTEMPTS - allGuesses.length;

  await ctx.replyWithPhoto(wordleImageFile(imageBuffer), {
    caption: `${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} remaining`,
  });
}

async function handleDailyWordleWin(
  ctx: Context,
  dailyWord: DailyWord,
  allGuesses: GuessEntry[],
) {
  const userId = ctx.from!.id.toString();

  await redis.del(redisKeys.dailySession(userId));

  const streak = await recordWinStreak(userId);
  if (!streak) return;

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const shareText = generateWordleShareText(
    dailyWord.dayNumber,
    allGuesses,
    dailyWord.word,
  );

  await ctx.replyWithPhoto(wordleImageFile(imageBuffer), {
    caption: `🎉 Congratulations! You guessed it in ${allGuesses.length} ${allGuesses.length === 1 ? "try" : "tries"}!\n\n🔥 Current Streak: ${streak.currentStreak}\n⭐ Highest Streak: ${streak.highestStreak}\n\n${formatDailyWordDetails(dailyWord)}`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📤 Share",
            switch_inline_query: shareText,
          },
        ],
      ],
    },
  });

  reactWithRandom(ctx);
}

async function handleDailyWordleLoss(
  ctx: Context,
  dailyWord: DailyWord,
  allGuesses: GuessEntry[],
) {
  const userId = ctx.from!.id.toString();

  await redis.del(redisKeys.dailySession(userId));
  await resetStreak(userId);

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const shareText = generateWordleShareText(
    dailyWord.dayNumber,
    allGuesses,
    dailyWord.word,
  );

  await ctx.replyWithPhoto(wordleImageFile(imageBuffer), {
    caption: `Game Over! The word was: ${dailyWord.word.toUpperCase()}\n\n💔 Streak reset to 0\n\n${formatDailyWordDetails(dailyWord)}\n\nCome back tomorrow for a new challenge!`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📤 Share",
            switch_inline_query: shareText,
          },
        ],
      ],
    },
  });
}

const SHARE_EMOJI = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
} as const;

export function generateWordleShareText(
  dayNumber: number,
  guesses: GuessEntry[],
  solution: string,
) {
  const totalAttempts = guesses.length;
  const attemptLine = `${dayNumber} ${totalAttempts}/${DAILY_ATTEMPTS}`;

  const lines = guesses.map((entry) =>
    evaluateGuess(entry.guess, solution)
      .map((state) => SHARE_EMOJI[state])
      .join(""),
  );

  return `WordSeek ${attemptLine}\n\n${lines.join("\n")}\nTry yourself by using /daily command.`;
}
