import { db } from "#/config/db";
import { env } from "#/config/env";

import { getWordDetails } from "./word-details";
import { resetStreaksForInactivePlayers } from "./streaks";
import { getCurrentGameDateString, getDateStringFromDate } from "./date";
import {
  deterministicShuffle,
  getWordOfTheDay,
  seedFromSecret,
} from "./word-of-the-day";

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

  console.log(`Successfully generated daily word: ${word} for ${gameDate}`);
  return insertedWord;
}

export async function generateDailyWord() {
  try {
    const gameDate = getCurrentGameDateString();
    console.log(
      "Generating daily word for",
      gameDate,
      "at",
      new Date().toISOString(),
    );

    await generateDailyWordInternal(gameDate);
  } catch (error) {
    console.error("Error generating daily word:", error);
  }
}

export async function ensureDailyWordExists(gameDate?: string) {
  try {
    const dateToUse = gameDate ?? getCurrentGameDateString();
    return await generateDailyWordInternal(dateToUse);
  } catch (error) {
    console.error("Error ensuring daily word exists:", error);
    return null;
  }
}
