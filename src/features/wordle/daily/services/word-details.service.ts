import { z } from "zod";

import { env } from "#/config/env";
import { SYSTEM_PROMPT } from "#/config/constants";
import { APIKeyManager } from "#/features/wordle/daily/services/key-manager.service";

const keyManager = new APIKeyManager();

const FREE_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.0-flash",
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

export type WordDetails = z.infer<typeof wordDetailsSchema>;

export async function getWordDetails(
  word: string,
  maxRetries: number = env.GEMINI_API_KEYS.length * FREE_MODELS.length * 2,
): Promise<WordDetails | undefined> {
  await keyManager.initialize();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { genAI } = await keyManager.getWorkingKey();

      const modelIndex = (attempt - 1) % FREE_MODELS.length;
      const modelName = FREE_MODELS[modelIndex];
      if (!modelName) continue;

      const ai = genAI.getGenerativeModel({ model: modelName });

      const prompt = `${SYSTEM_PROMPT}\n **THE WORD TO CREATE HINTS FOR:** ${word}`;
      const result = await ai.generateContent(prompt);

      let text = result.response.text();
      text = text.replace(/```json|```/g, "").trim();

      const parsed = JSON.parse(text);
      return wordDetailsSchema.parse(parsed);
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
