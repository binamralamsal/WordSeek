import { afterAll, describe, expect, test } from "bun:test";

import { redisKeys } from "#/core/redis-keys.constants";
import { captchaSchema } from "#/features/admin/captcha/captcha.schema";
import { setCaptchaEnqueuer } from "#/features/admin/captcha/captcha-queue.service";

import { TestBot } from "../helpers/harness";
import { seedScore, seedUser } from "../helpers/fixtures";
import { flushAsyncWork, setupTestEnvironment } from "../helpers/env";

const env = setupTestEnvironment();

const enqueued: unknown[] = [];

setCaptchaEnqueuer(async (job) => {
  enqueued.push(job);
});

afterAll(() => {
  setCaptchaEnqueuer(null);
});

describe("/ban and /unban", () => {
  test("bans and unbans an existing user", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    const bot = new TestBot();

    await bot.sendText("/ban 4242", { id: 999 });
    expect(bot.lastText()).toContain("Banned Ada");
    expect(
      await env.db
        .selectFrom("bannedUsers")
        .select("userId")
        .where("userId", "=", "4242")
        .executeTakeFirst(),
    ).toBeDefined();

    await bot.sendText("/ban 4242", { id: 999 });
    expect(bot.lastText()).toContain("already banned");

    await bot.sendText("/unban 4242", { id: 999 });
    expect(bot.lastText()).toContain("Unbanned Ada");
    expect(
      await env.db.selectFrom("bannedUsers").selectAll().execute(),
    ).toHaveLength(0);

    await bot.sendText("/unban 4242", { id: 999 });
    expect(bot.lastText()).toContain("is not banned");
  });

  test("resolves usernames with the @ prefix", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    const bot = new TestBot();

    await bot.sendText("/ban @ada", { id: 999 });
    expect(bot.lastText()).toContain("Banned Ada");
  });

  test("ignores non-admin callers", async () => {
    const bot = new TestBot();

    await bot.sendText("/ban 4242", { id: 7001 });

    expect(bot.texts()).toHaveLength(0);
  });

  test("reports users that cannot be found", async () => {
    const bot = new TestBot();

    await bot.sendText("/unban 9999", { id: 999 });

    expect(bot.lastText()).toBe("Can't find the user");
  });
});

describe("/track family", () => {
  test("tracks, lists and untracks a chat", async () => {
    const bot = new TestBot();

    await bot.sendText("/track -100123", { id: 999 });
    expect(bot.lastText()).toContain("Now tracking chat: -100123");
    expect(await env.redis.get(redisKeys.tracking(-100123))).toBe("999");

    await bot.sendText("/track -100123", { id: 999 });
    expect(bot.lastText()).toContain("already being tracked");

    await bot.sendText("/tracklist", { id: 999 });
    expect(bot.lastText()).toContain("-100123");

    await bot.sendText("/untrack -100123", { id: 999 });
    expect(bot.lastText()).toContain("Stopped tracking chat: -100123");

    await bot.sendText("/untrack -100123", { id: 999 });
    expect(bot.lastText()).toContain("is not being tracked");
  });

  test("shows usage and empty state", async () => {
    const bot = new TestBot();

    await bot.sendText("/track", { id: 999 });
    expect(bot.lastText()).toContain("Usage: /track");

    await bot.sendText("/tracklist", { id: 999 });
    expect(bot.lastText()).toContain("No chats are currently being tracked");
  });
});

describe("/stats", () => {
  test("reports database counts and runtime information", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    await flushAsyncWork();

    const bot = new TestBot();
    await bot.sendText("/stats", { id: 999 });

    const text = bot.lastText() ?? "";
    expect(text).toContain("Bot Statistics");
    expect(text).toContain("Total Users");
    expect(text).toContain("VPS System");
    expect(text).toContain("Bun Version");
  });

  test("is restricted to system admins", async () => {
    const bot = new TestBot();

    await bot.sendText("/stats", { id: 7001 });

    expect(bot.texts()).toHaveLength(0);
  });
});

describe("/transfer", () => {
  test("moves leaderboard rows to another user", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    await seedUser(env.db, { id: "5252", name: "Grace", username: "grace" });
    await seedScore(env.db, { userId: "4242", chatId: "1", score: 30 });
    await seedScore(env.db, { userId: "4242", chatId: "2", score: 20 });

    const bot = new TestBot();
    await bot.sendText("/transfer 4242 5252", { id: 999 });

    expect(bot.lastText()).toContain("Successfully transferred");
    expect(bot.lastText()).toContain("Entries transferred: 2");
    expect(bot.lastText()).toContain("Total score transferred: 50");

    const rows = await env.db
      .selectFrom("leaderboard")
      .select(["userId", "score"])
      .where("userId", "=", "5252")
      .execute();
    expect(rows).toHaveLength(2);
  });

  test("validates arguments and users", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    await seedUser(env.db, { id: "5252", name: "Grace", username: "grace" });

    const bot = new TestBot();

    await bot.sendText("/transfer 4242", { id: 999 });
    expect(bot.lastText()).toContain("Usage: /transfer");

    await bot.sendText("/transfer 9999 5252", { id: 999 });
    expect(bot.lastText()).toContain("Source user not found");

    await bot.sendText("/transfer 4242 9999", { id: 999 });
    expect(bot.lastText()).toContain("Destination user not found");

    await bot.sendText("/transfer 4242 4242", { id: 999 });
    expect(bot.lastText()).toContain("Cannot transfer to the same user");

    await bot.sendText("/transfer 4242 5252", { id: 999 });
    expect(bot.lastText()).toContain("has no leaderboard entries");
  });
});

describe("/captcha", () => {
  test("creates a captcha session and schedules its expiry", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    enqueued.length = 0;

    const bot = new TestBot();
    await bot.sendText("/captcha -1001 4242", { id: 999 });

    expect(bot.lastText()).toContain("Captcha sent");
    expect(enqueued).toHaveLength(1);

    const raw = await env.redis.get(redisKeys.captcha("-1001", "4242"));
    const session = captchaSchema.parse(JSON.parse(raw!));
    expect(session.attempts).toBe(0);
    expect(session.answer).toHaveLength(3);
    expect(session.answer.every((symbol) => typeof symbol === "string")).toBe(
      true,
    );

    await bot.sendText("/captcha -1001 4242", { id: 999 });
    expect(bot.lastText()).toContain("already active");
  });

  test("requires usage arguments", async () => {
    const bot = new TestBot();

    await bot.sendText("/captcha", { id: 999 });

    expect(bot.lastText()).toContain("Usage: /captcha");
  });

  test("is ignored outside private chats and for non-admins", async () => {
    const bot = new TestBot();

    await bot.sendText("/captcha -1001 4242", { id: 999, chatType: "group" });
    await bot.sendText("/captcha -1001 4242", { id: 7001 });

    expect(bot.texts()).toHaveLength(0);
  });
});
