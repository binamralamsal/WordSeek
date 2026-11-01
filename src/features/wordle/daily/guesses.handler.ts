import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { formatDailyWordDetails } from "#/core/format/word-details.helper";
import { redisKeys } from "#/core/redis-keys.constants";
import { replyNotice } from "#/core/telegram/reply-notice.helper";
import { renderInlineKeyboard } from "#/core/telegram/rich-keyboard.helper";

import { sendBoardMessage } from "../shared/helpers/board-message.helper";
import { evaluateGuess } from "../shared/helpers/board.helper";
import { generateWordleImage } from "../shared/helpers/image.helper";
import { reactWithRandom } from "../shared/helpers/reactions.helper";
import { ALL_WORDS } from "../shared/helpers/words.helper";
import type { DailyWord, GuessEntry } from "../shared/types";
import { getCurrentGameDateString } from "./helpers/date.helper";
import { recordWinStreak, resetStreak } from "./services/streaks.service";

const DAILY_ATTEMPTS = 6;

function shareKeyboard(shareText: string) {
  return renderInlineKeyboard(
    new InlineKeyboard().switchInline("📤 Share", shareText),
  );
}

export async function handleDailyWordleGuess(
  ctx: Context,
  currentGuess: string,
) {
  const userId = ctx.from!.id.toString();

  if (!ALL_WORDS[5].includes(currentGuess)) {
    return replyNotice(
      ctx,
      `${currentGuess.toUpperCase()} is not a valid word.`,
    );
  }

  const todayDate = getCurrentGameDateString();

  const dailyWord = await db
    .selectFrom("dailyWords")
    .selectAll()
    .where("date", "=", new Date(todayDate))
    .executeTakeFirst();

  if (!dailyWord) {
    return replyNotice(
      ctx,
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
    return replyNotice(
      ctx,
      "You've already guessed this word. Try a different one!",
    );
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
  const attemptsLabel = attemptsLeft === 1 ? "attempt" : "attempts";

  await sendBoardMessage(
    ctx,
    imageBuffer,
    `<p><b>${attemptsLeft}</b> ${attemptsLabel} remaining</p>`,
    { caption: `${attemptsLeft} ${attemptsLabel} remaining` },
  );
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
  const triesLabel = allGuesses.length === 1 ? "try" : "tries";
  const details = formatDailyWordDetails(dailyWord);
  const captionDetails = formatDailyWordDetails(dailyWord, "\n");

  await sendBoardMessage(
    ctx,
    imageBuffer,
    `<h5>🎉 You Guessed It!</h5>
<p>Solved today's WordSeek in <b>${allGuesses.length}</b> ${triesLabel}.</p>
<blockquote>🔥 Current streak <b>${streak.currentStreak}</b><br>⭐ Highest streak <b>${streak.highestStreak}</b></blockquote>
${details}
${shareKeyboard(shareText)}`,
    {
      caption: `🎉 Congratulations! You guessed it in ${allGuesses.length} ${triesLabel}!\n\n🔥 Current Streak: ${streak.currentStreak}\n⭐ Highest Streak: ${streak.highestStreak}\n\n${captionDetails}`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📤 Share",
              switch_inline_query: shareText,
            },
          ],
        ],
      },
    },
  );

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
  const details = formatDailyWordDetails(dailyWord);
  const captionDetails = formatDailyWordDetails(dailyWord, "\n");

  await sendBoardMessage(
    ctx,
    imageBuffer,
    `<h5>💔 Game Over</h5>
<p>The word was <b>${dailyWord.word.toUpperCase()}</b>.</p>
<blockquote>Streak reset to <b>0</b></blockquote>
${details}
<footer>Come back tomorrow for a new challenge!</footer>
${shareKeyboard(shareText)}`,
    {
      caption: `Game Over! The word was: ${dailyWord.word.toUpperCase()}\n\n💔 Streak reset to 0\n\n${captionDetails}\n\nCome back tomorrow for a new challenge!`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📤 Share",
              switch_inline_query: shareText,
            },
          ],
        ],
      },
    },
  );
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
