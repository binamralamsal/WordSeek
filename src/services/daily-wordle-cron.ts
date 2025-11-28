import { CronJob } from "cron";
import crypto from "crypto";
import z from "zod";

import { SYSTEM_PROMPT } from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import words from "../data/allWords.json";
import { APIKeyManager } from "../util/key-manager";

const keyManager = new APIKeyManager();

keyManager.initialize();

const FREE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const wordDetailsSchema = z.object({
  word: z.string(),
  phonetic: z.string(),
  meaning: z.string(),
  sentence: z.string(),
});

async function getWordDetails(
  word: string,
  maxRetries: number = env.GEMINI_API_KEYS.length * FREE_MODELS.length * 2,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { genAI } = await keyManager.getWorkingKey();

      const modelIndex = (attempt - 1) % FREE_MODELS.length;
      const modelName = FREE_MODELS[modelIndex];
      if (!modelName) continue;

      const ai = genAI.getGenerativeModel({ model: modelName });

      const prompt = `${SYSTEM_PROMPT}
 **THE WORD TO CREATE HINTS FOR:** ${word}`;
      const result = await ai.generateContent(prompt);

      let text = result.response.text();
      text = text.replace(/```json|```/g, "").trim();

      const parsed = JSON.parse(text);
      const validated = wordDetailsSchema.parse(parsed);

      return validated;
    } catch (error) {
      const { key } = await keyManager.getWorkingKey();

      if (isAPIKeyError(error as Error)) {
        await keyManager.markKeyAsFailed(key);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (attempt === maxRetries || keyManager.getAvailableKeysCount() === 0) {
        break;
      }
    }
  }
}

async function generateDailyWord() {
  try {
    console.log("Generating daily word for", new Date().toISOString());

    const today = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kathmandu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [month, day, year] = today.split("/");
    const todayDate = `${year}-${month}-${day}`;

    const existingWord = await db
      .selectFrom("dailyWords")
      .selectAll()
      .where("date", "=", new Date(todayDate))
      .executeTakeFirst();

    if (existingWord) {
      console.log("Daily word already exists for today:", existingWord.word);
      return;
    }

    const seed = seedFromSecret(env.DAILY_WORDLE_SECRET);
    const shuffled = deterministicShuffle(seed);
    const word = getWordOfTheDay(shuffled);

    const details = await getWordDetails(word);

    await db
      .insertInto("dailyWords")
      .values({
        word: word,
        date: todayDate,
        meaning: details?.meaning,
        phonetic: details?.phonetic,
        sentence: details?.sentence,
      })
      .execute();

    console.log(`Successfully generated daily word: ${word} for ${todayDate}`);
  } catch (error) {
    console.error("Error generating daily word:", error);
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

function getWordOfTheDay(shuffled: string[]) {
  const msPerDay = 24 * 60 * 60 * 1000;

  const dayNumber = Math.floor(
    (Date.now() - env.DAILY_WORDLE_START_DATE.getTime()) / msPerDay,
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
