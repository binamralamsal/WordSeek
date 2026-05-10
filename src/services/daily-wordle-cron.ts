import { CronJob } from "cron";
import crypto from "crypto";
import z from "zod";

import { SYSTEM_PROMPT } from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import words from "../data/daily-word-lists.json";
import { APIKeyManager } from "../util/key-manager";

const keyManager = new APIKeyManager();

keyManager.initialize();

const FREE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-2.5-flash",
];

const allowedTags = ["b", "i", "u"];

function sanitizeMeaning(input: string) {
  return input.replace(
    /<\/?([a-zA-Z0-9]+)([^>]*)>/g,
    (match, tagName: string) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match.replace(/ .*>/, ">");
      }
      return "";
    },
  );
}

const wordDetailsSchema = z.object({
  word: z.string(),
  phonetic: z.string(),
  meaning: z.string().transform((val) => sanitizeMeaning(val)),
  sentence: z.string(),
});

async function getWordDetails(
  word: string,
  maxRetries: number = env.GEMINI_API_KEYS.length * FREE_MODELS.length * 2,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let currentKey: string | undefined;
    try {
      const { key, genAI } = await keyManager.getWorkingKey();
      currentKey = key;

      const modelIndex = (attempt - 1) % FREE_MODELS.length;
      const modelName = FREE_MODELS[modelIndex];
      if (!modelName) continue;

      const ai = genAI.getGenerativeModel({ model: modelName });

      const prompt = `${SYSTEM_PROMPT}\n **THE WORD TO CREATE HINTS FOR:** ${word}`;
      const result = await ai.generateContent(prompt);

      let text = result.response.text();
      text = text.replace(/```json|```/g, "").trim();

      const parsed = JSON.parse(text);
      const validated = wordDetailsSchema.parse(parsed);

      return validated;
    } catch (error) {
      if (currentKey && isAPIKeyError(error as Error)) {
        await keyManager.markKeyAsFailed(currentKey);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (attempt === maxRetries || keyManager.getAvailableKeysCount() === 0) {
        break;
      }
    }
  }
}

function getDateStringFromDate(d: Date) {
  // Use UTC parts to ensure consistency if the date was created with UTC midnight
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentGameDateString() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;

  const dateString = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"), 10);

  if (hour < 6) {
    const d = new Date(dateString + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return getDateStringFromDate(d);
  }

  return dateString;
}

async function resetStreaksForInactivePlayers(yesterdayDate: string) {
  try {
    console.log(
      `Resetting streaks for players who didn't play on ${yesterdayDate}`,
    );

    // The game day for yesterdayDate started at 06:00 AM in env.TIME_ZONE
    // We should reset streaks for anyone whose lastGuessed is before that.
    
    // To get 06:00 AM yesterday in the target timezone:
    const yesterdayStartTime = new Date(`${yesterdayDate}T06:00:00Z`); 
    // Note: This is a simplification. Ideally we'd use a library like luxon, 
    // but we can estimate or just use the date boundary if we store lastGuessed in UTC.
    // If lastGuessed is ISO string (UTC), then we need the UTC timestamp of 6AM in target TZ.

    const result = await db
      .updateTable("userStats")
      .set({ currentStreak: 0 })
      .where("currentStreak", ">", 0)
      .where((eb) =>
        eb.or([
          eb("lastGuessed", "is", null),
          eb("lastGuessed", "<", yesterdayStartTime),
        ]),
      )
      .execute();

    const resetCount = result.reduce(
      (sum, r) => sum + Number(r.numUpdatedRows || 0n),
      0,
    );

    if (resetCount > 0) {
      console.log(`Reset streaks for ${resetCount} inactive players`);
    } else {
      console.log("No inactive players found to reset");
    }
  } catch (error) {
    console.error("Error resetting streaks for inactive players:", error);
  }
}

async function generateDailyWordInternal(gameDate: string) {
  const existingWord = await db
    .selectFrom("dailyWords")
    .selectAll()
    .where("date", "=", new Date(gameDate))
    .executeTakeFirst();

  if (existingWord) return existingWord;

  const seed = seedFromSecret(env.DAILY_WORDLE_SECRET);
  const shuffled = deterministicShuffle(seed);
  const word = getWordOfTheDay(shuffled, gameDate);

  const details = await getWordDetails(word);

  if (!details) {
    console.warn(`Failed to fetch AI details for word: ${word}. Inserting with null details.`);
  }

  const insertedWord = await db
    .insertInto("dailyWords")
    .values({
      word,
      date: gameDate,
      meaning: details?.meaning ?? null,
      phonetic: details?.phonetic ?? null,
      sentence: details?.sentence ?? null,
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

async function generateDailyWord() {
  try {
    const gameDate = getCurrentGameDateString();
    console.log(
      "Generating daily word for",
      gameDate,
      "at",
      new Date().toISOString(),
    );

    // Generate today's word
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

function seedFromSecret(secret: string) {
  const h = crypto
    .createHmac("sha256", secret)
    .update("wotd-permutation-seed")
    .digest();
  return h.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(seed: number) {
  const arr = words.slice();
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getWordOfTheDay(shuffled: string[], gameDate: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const targetDate = new Date(gameDate + "T00:00:00Z"); // Use UTC to stay consistent with env.DAILY_WORDLE_START_DATE

  const dayNumber = Math.floor(
    (targetDate.getTime() - env.DAILY_WORDLE_START_DATE.getTime()) / msPerDay,
  );

  return shuffled[
    ((dayNumber % shuffled.length) + shuffled.length) % shuffled.length
  ];
}

export const dailyWordleCron = new CronJob(
  "0 6 * * *",
  generateDailyWord,
  null,
  false,
  env.TIME_ZONE,
);

function isAPIKeyError(error: Error): boolean {
  const errorStr = error.toString().toLowerCase();
  const apiKeyErrorPatterns = [
    "api key",
    "unauthorized",
    "invalid key",
    "quota exceeded",
    "rate limit",
    "forbidden",
    "401",
    "403",
    "429",
  ];

  return apiKeyErrorPatterns.some((pattern) => errorStr.includes(pattern));
}
