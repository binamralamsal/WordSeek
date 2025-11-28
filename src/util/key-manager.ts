import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "../config/env";
import { redis } from "../config/redis";

const FAILED_KEYS_KEY = `seek-gemini:failed_keys`;
const RETRY_AFTER_MINUTES = 30;

export class APIKeyManager {
  private currentKeyIndex = 0;
  private failedKeys = new Set<string>();

  async initialize() {
    const failedKeysData = await redis.get(FAILED_KEYS_KEY);
    if (failedKeysData) {
      const parsed = JSON.parse(failedKeysData);
      const now = Date.now();
      this.failedKeys = new Set(
        Object.entries(parsed)
          .filter(
            ([, timestamp]) =>
              now - (timestamp as number) < RETRY_AFTER_MINUTES * 60 * 1000,
          )
          .map(([key]) => key),
      );
    }
  }

  async getWorkingKey(): Promise<{ key: string; genAI: GoogleGenerativeAI }> {
    const availableKeys = env.GEMINI_API_KEYS.filter(
      (key) => !this.failedKeys.has(key),
    );

    if (availableKeys.length === 0) {
      await this.resetFailedKeys();
      return this.getWorkingKey();
    }

    this.currentKeyIndex = this.currentKeyIndex % availableKeys.length;
    const selectedKey = availableKeys[this.currentKeyIndex];
    this.currentKeyIndex++;

    if (!selectedKey) {
      throw new Error("No API keys available");
    }

    const genAI = new GoogleGenerativeAI(selectedKey);
    return { key: selectedKey, genAI };
  }

  async markKeyAsFailed(key: string) {
    this.failedKeys.add(key);

    const failedKeysData = await redis.get(FAILED_KEYS_KEY);
    const parsed = failedKeysData ? JSON.parse(failedKeysData) : {};
    parsed[key] = Date.now();

    await redis.setex(
      FAILED_KEYS_KEY,
      RETRY_AFTER_MINUTES * 60,
      JSON.stringify(parsed),
    );
  }

  async resetFailedKeys() {
    this.failedKeys.clear();
    await redis.del(FAILED_KEYS_KEY);
  }

  getAvailableKeysCount(): number {
    return env.GEMINI_API_KEYS.filter((key) => !this.failedKeys.has(key))
      .length;
  }
}
