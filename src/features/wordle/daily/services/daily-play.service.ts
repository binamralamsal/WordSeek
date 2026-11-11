import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys.constants";
import type { MiniAppDailyState, MiniAppGuess } from "#/shared/miniapp";
import { evaluateGuess } from "#/shared/wordle";

import { ALL_WORDS } from "../../shared/helpers/words.helper";
import { recordDailyResult } from "../../shared/services/game-stats.service";
import { getCurrentGameDateString } from "../helpers/date.helper";
import { ensureDailyWordExists } from "./daily-word.service";
import {
  ensureUserStats,
  getUserStreak,
  recordWinStreak,
  resetStreak,
} from "./streaks.service";

export const DAILY_ATTEMPTS = 6;
const DAILY_WORD_LENGTH = 5;

export type DailyGuessErrorCode =
  "DAILY_UNAVAILABLE" | "INVALID_WORD" | "DUPLICATE_GUESS" | "DAILY_FINISHED";

export type DailyGuessResult =
  | { ok: true; state: MiniAppDailyState; dailyWord: DailyWordRow }
  | {
      ok: false;
      code: DailyGuessErrorCode;
      message: string;
      state?: MiniAppDailyState;
    };

export type DailyWordRow = {
  id: number;
  word: string;
  dayNumber: number;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
};

function toGuesses(
  rows: { guess: string }[],
  solution: string,
): MiniAppGuess[] {
  return rows.map((row) => ({
    guess: row.guess,
    states: evaluateGuess(row.guess, solution),
  }));
}

async function loadTodayWord(): Promise<DailyWordRow | null> {
  return (await ensureDailyWordExists()) as DailyWordRow | null;
}

async function getOrderedGuesses(userId: string, dailyWordId: number) {
  return await db
    .selectFrom("dailyGuesses")
    .select(["guess", "attemptNumber"])
    .where("userId", "=", userId)
    .where("dailyWordId", "=", dailyWordId)
    .orderBy("attemptNumber", "asc")
    .execute();
}

function buildState(
  dailyWord: DailyWordRow,
  rows: { guess: string }[],
  streak: { currentStreak: number; highestStreak: number } | undefined,
): MiniAppDailyState {
  const solved = rows.some((row) => row.guess === dailyWord.word);
  const lost = !solved && rows.length >= DAILY_ATTEMPTS;
  const status = solved ? "won" : lost ? "lost" : "playing";
  const finished = status !== "playing";

  return {
    date: getCurrentGameDateString(),
    dayNumber: dailyWord.dayNumber,
    wordLength: DAILY_WORD_LENGTH,
    maxAttempts: DAILY_ATTEMPTS,
    guesses: toGuesses(rows, dailyWord.word),
    status,
    solution: finished ? dailyWord.word : null,
    details: finished
      ? {
          meaning: dailyWord.meaning,
          phonetic: dailyWord.phonetic,
          sentence: dailyWord.sentence,
        }
      : null,
    streak: {
      current: streak?.currentStreak ?? 0,
      highest: streak?.highestStreak ?? 0,
    },
    startedInChat: rows.length > 0,
  };
}

/**
 * Returns today's puzzle for a player. The solution and word details are only
 * exposed once the puzzle is won or lost, matching the bot's behaviour.
 */
export async function getDailyState(userId: string) {
  const dailyWord = await loadTodayWord();

  if (!dailyWord) {
    return {
      ok: false as const,
      code: "DAILY_UNAVAILABLE" as const,
      message: "Today's WordSeek isn't ready yet. Please try again shortly.",
    };
  }

  await ensureUserStats(userId);

  const [rows, streak] = await Promise.all([
    getOrderedGuesses(userId, dailyWord.id),
    getUserStreak(userId),
  ]);

  return { ok: true as const, state: buildState(dailyWord, rows, streak) };
}

export async function submitDailyGuess(
  userId: string,
  rawGuess: string,
): Promise<DailyGuessResult> {
  const guess = rawGuess.trim().toLowerCase();

  if (
    guess.length !== DAILY_WORD_LENGTH ||
    !/^[a-z]+$/.test(guess) ||
    !ALL_WORDS[DAILY_WORD_LENGTH].includes(guess)
  ) {
    return {
      ok: false,
      code: "INVALID_WORD",
      message: `${rawGuess.toUpperCase()} is not a valid 5-letter word.`,
    };
  }

  const dailyWord = await loadTodayWord();

  if (!dailyWord) {
    return {
      ok: false,
      code: "DAILY_UNAVAILABLE",
      message: "Today's WordSeek isn't ready yet. Please try again shortly.",
    };
  }

  await ensureUserStats(userId);

  const existing = await getOrderedGuesses(userId, dailyWord.id);
  const currentStreak = await getUserStreak(userId);

  if (
    existing.some((row) => row.guess === dailyWord.word) ||
    existing.length >= DAILY_ATTEMPTS
  ) {
    return {
      ok: false,
      code: "DAILY_FINISHED",
      message: "You've already finished today's WordSeek.",
      state: buildState(dailyWord, existing, currentStreak),
    };
  }

  if (existing.some((row) => row.guess === guess)) {
    return {
      ok: false,
      code: "DUPLICATE_GUESS",
      message: "You've already guessed this word. Try a different one!",
      state: buildState(dailyWord, existing, currentStreak),
    };
  }

  const attemptNumber = existing.length + 1;

  await db
    .insertInto("dailyGuesses")
    .values({
      userId,
      dailyWordId: dailyWord.id,
      guess,
      attemptNumber,
    })
    .execute();

  const rows = await getOrderedGuesses(userId, dailyWord.id);

  if (guess === dailyWord.word) {
    await redis.del(redisKeys.dailySession(userId));
    await recordDailyResult(userId, true);
    const streak = await recordWinStreak(userId);
    return {
      ok: true,
      dailyWord,
      state: buildState(
        dailyWord,
        rows,
        streak ?? { currentStreak: 0, highestStreak: 0 },
      ),
    };
  }

  if (rows.length >= DAILY_ATTEMPTS) {
    await redis.del(redisKeys.dailySession(userId));
    await recordDailyResult(userId, false);
    await resetStreak(userId);
    return {
      ok: true,
      dailyWord,
      state: buildState(dailyWord, rows, {
        currentStreak: 0,
        highestStreak: currentStreak?.highestStreak ?? 0,
      }),
    };
  }

  return {
    ok: true,
    dailyWord,
    state: buildState(dailyWord, rows, currentStreak ?? undefined),
  };
}
