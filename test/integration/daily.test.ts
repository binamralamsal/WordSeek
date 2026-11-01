import { describe, expect, test } from "bun:test";

import { redisKeys } from "#/core/redis-keys.constants";
import { getCurrentGameDateString } from "#/features/wordle/daily/helpers/date.helper";
import { ALL_WORDS } from "#/features/wordle/shared/helpers/words.helper";

import { setupTestEnvironment } from "../helpers/env";
import { seedDailyWord, seedGame, seedUser } from "../helpers/fixtures";
import { TestBot } from "../helpers/harness";
import { parseRichButtons } from "../helpers/rich-message";

const env = setupTestEnvironment();

const PLAYER_ID = 7_001;
const SOLUTION = "crane";

async function seedPlayer(options: { streak?: number } = {}) {
  await seedUser(env.db, {
    id: String(PLAYER_ID),
    name: "Ada",
    username: "ada",
  });

  if (options.streak !== undefined) {
    await env.db
      .insertInto("userStats")
      .values({
        userId: String(PLAYER_ID),
        currentStreak: options.streak,
        highestStreak: options.streak,
      })
      .execute();
  }
}

async function seedToday(solution = SOLUTION) {
  return seedDailyWord(env.db, {
    word: solution,
    date: getCurrentGameDateString(),
    meaning: "A large bird",
  });
}

function wrongWords(solution: string, count: number): string[] {
  return ALL_WORDS[5].filter((word) => word !== solution).slice(0, count);
}

describe("/daily", () => {
  test("starts today's game in private chat", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("WordSeek of the Day");
    expect(bot.lastText()).toContain("5-letter");
    expect(await env.redis.get(redisKeys.dailySession(PLAYER_ID))).toContain(
      '"dailyWordId"',
    );
  });

  test("blocks group chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/daily", { id: PLAYER_ID, chatType: "group" });

    expect(bot.lastText()).toContain("only be played in private chat");
  });

  test("blocks users with an active regular game", async () => {
    await seedPlayer();
    await seedGame(env.db, {
      activeChat: String(PLAYER_ID),
      word: SOLUTION,
    });

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("active regular WordSeek game");
  });

  test("resumes an unfinished game with a board image", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    const wrong = wrongWords(SOLUTION, 1)[0]!;
    await bot.sendText(wrong, { id: PLAYER_ID });

    await bot.sendText("/daily", { id: PLAYER_ID });

    const rich = bot.lastCall("sendRichMessage");
    expect(rich?.payload.rich_message.html).toContain("Welcome back!");
    expect(rich?.payload.rich_message.html).toContain("attempts left today");
    expect(rich?.payload.rich_message.media).toHaveLength(1);
    expect(rich?.payload.rich_message.media[0].id).toBe("board");
  });

  test("reports an already completed game", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    await bot.sendText(SOLUTION, { id: PLAYER_ID });

    await bot.sendText("/daily", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Daily Already Solved");
    expect(bot.lastText()).toContain("1</b> try");
  });

  test("reports an exhausted game", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    for (const guess of wrongWords(SOLUTION, 6)) {
      await bot.sendText(guess, { id: PLAYER_ID });
    }

    await bot.sendText("/daily", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Out of Attempts");
    expect(bot.lastText()).toContain(SOLUTION.toUpperCase());
  });

  test("fails gracefully when the word is not ready", async () => {
    await seedPlayer();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });

    // The service tries to generate a word; without word details it still
    // persists the generated word, so the game should start.
    expect(bot.texts().length).toBeGreaterThan(0);
    expect(bot.errors).toHaveLength(0);
  });
});

describe("daily guesses", () => {
  test("rejects words outside the dictionary", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });

    await bot.sendText("zzzzz", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("is not a valid word");
    expect(
      await env.db.selectFrom("dailyGuesses").selectAll().execute(),
    ).toHaveLength(0);
  });

  test("rejects duplicate guesses", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    const wrong = wrongWords(SOLUTION, 1)[0]!;
    await bot.sendText(wrong, { id: PLAYER_ID });
    await bot.sendText(wrong, { id: PLAYER_ID });

    expect(bot.lastText()).toContain("already guessed this word");
  });

  test("shows the remaining attempts after a wrong guess", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    await bot.sendText(wrongWords(SOLUTION, 1)[0]!, { id: PLAYER_ID });

    const rich = bot.lastCall("sendRichMessage");
    expect(rich?.payload.rich_message.html).toContain("attempts remaining");
    expect(
      await env.db.selectFrom("dailyGuesses").selectAll().execute(),
    ).toHaveLength(1);
  });

  test("reports an expired session and clears it", async () => {
    await seedPlayer();
    await seedToday();
    await env.redis.setex(
      redisKeys.dailySession(PLAYER_ID),
      60,
      JSON.stringify({ dailyWordId: 1, date: "2000-01-01" }),
    );

    const bot = new TestBot();
    await bot.sendText(wrongWords(SOLUTION, 1)[0]!, { id: PLAYER_ID });

    expect(bot.lastText()).toContain("previous game has expired");
    expect(await env.redis.get(redisKeys.dailySession(PLAYER_ID))).toBeNull();
  });

  test("wins, records the streak and clears the session", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    await bot.sendText(SOLUTION, { id: PLAYER_ID });

    const rich = bot.lastCall("sendRichMessage");
    const html = rich?.payload.rich_message.html ?? "";
    expect(html).toContain("You Guessed It!");
    expect(html).toContain("1</b> try");
    expect(html).toContain("Current streak <b>1</b>");
    expect(html).toContain("Highest streak <b>1</b>");
    expect(html).toContain("tg://photo?id=board");
    expect(parseRichButtons(html).some((b) => b.text.includes("Share"))).toBe(
      true,
    );
    expect(rich?.payload.reply_markup).toBeUndefined();
    expect(await env.redis.get(redisKeys.dailySession(PLAYER_ID))).toBeNull();

    const stats = await env.db
      .selectFrom("userStats")
      .selectAll()
      .where("userId", "=", String(PLAYER_ID))
      .executeTakeFirstOrThrow();
    expect(stats.currentStreak).toBe(1);
    expect(stats.highestStreak).toBe(1);
  });

  test("loses after six attempts and resets the streak", async () => {
    await seedPlayer({ streak: 4 });
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    for (const guess of wrongWords(SOLUTION, 6)) {
      await bot.sendText(guess, { id: PLAYER_ID });
    }

    const rich = bot.lastCall("sendRichMessage");
    const html = rich?.payload.rich_message.html ?? "";
    expect(html).toContain("Game Over");
    expect(html).toContain(SOLUTION.toUpperCase());
    expect(html).toContain("Streak reset to <b>0</b>");
    expect(parseRichButtons(html).some((b) => b.text.includes("Share"))).toBe(
      true,
    );
    expect(await env.redis.get(redisKeys.dailySession(PLAYER_ID))).toBeNull();

    const stats = await env.db
      .selectFrom("userStats")
      .selectAll()
      .where("userId", "=", String(PLAYER_ID))
      .executeTakeFirstOrThrow();
    expect(stats.currentStreak).toBe(0);
  });
});

describe("/pausedaily", () => {
  test("pauses an active session", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    await bot.sendText("/pausedaily", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Daily Game Paused");
    expect(bot.lastText()).toContain("play regular WordSeek");
    expect(await env.redis.get(redisKeys.dailySession(PLAYER_ID))).toBeNull();
  });

  test("explains when there is nothing to pause", async () => {
    const bot = new TestBot();

    await bot.sendText("/pausedaily", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("have an active WordSeek of the Day game");
  });

  test("allows a regular game after pausing", async () => {
    await seedPlayer();
    await seedToday();

    const bot = new TestBot();
    await bot.sendText("/daily", { id: PLAYER_ID });
    await bot.sendText("/pausedaily", { id: PLAYER_ID });
    await bot.sendText("/new", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("Game started");
  });
});
