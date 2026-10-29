import { describe, expect, test } from "bun:test";

import { TestBot } from "./helpers/harness";
import { setupTestEnvironment } from "./helpers/env";

setupTestEnvironment();

describe("test harness", () => {
  test("boots the real app stack and answers /start", async () => {
    const bot = new TestBot();

    await bot.sendText("/start");

    expect(bot.errors).toHaveLength(0);
    expect(bot.texts().length).toBeGreaterThan(0);
    expect(bot.lastText()).toContain("Welcome to WordSeek");
  });
});
