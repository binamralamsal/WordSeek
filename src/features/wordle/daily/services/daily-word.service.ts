import { db } from "#/config/db";
import { env } from "#/config/env";

import { getWordDetails } from "./word-details.service";
import { resetStreaksForInactivePlayers } from "./streaks.service";
import { getCurrentGameDateString, getDateStringFromDate } from "../helpers/date.helper";
import { createLogger } from "#/core/logging/logger.service";
import {
  deterministicShuffle,
  getWordOfTheDay,
  seedFromSecret,
} from "../helpers/word-of-the-day.helper";

const log = createLogger("features.wordle.daily.services.daily-word.service");

async function generateDailyWordInternal(gameDate: string) {
  const existingWord = await db
    .selectFrom("dailyWords")
    .selectAll()
    .where("date", "=", new Date(gameDate))
    .executeTakeFirst();

  if (existingWord) return existingWord;

  const seed = seedFromSecret(env.DAILY_WORDLE_SECRET);
  const shuffled = deterministicShuffle(seed);
  const word = getWordOfTheDay(shuffled);

  const details = await getWordDetails(word);

  const insertedWord = await db
    .insertInto("dailyWords")
    .values({
      word,
      date: gameDate,
      meaning: details?.meaning,
      phonetic: details?.phonetic,
      sentence: details?.sentence,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const yesterday = new Date(gameDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = getDateStringFromDate(yesterday);

  await resetStreaksForInactivePlayers(yesterdayString);

  log.info(`Successfully generated daily word: ${word} for ${gameDate}`);
  return insertedWord;
}

export async function generateDailyWord() {
  try {
    const gameDate = getCurrentGameDateString();
    log.info({ gameDate }, "Generating daily word");

    await generateDailyWordInternal(gameDate);
  } catch (error) {
    log.error({ err: error }, "Error generating daily word:");
  }
}

export async function ensureDailyWordExists(gameDate?: string) {
  try {
    const dateToUse = gameDate ?? getCurrentGameDateString();
    return await generateDailyWordInternal(dateToUse);
  } catch (error) {
    log.error({ err: error }, "Error ensuring daily word exists:");
    return null;
  }
}
