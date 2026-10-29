import { describe, expect, test } from "bun:test";

import { setupTestEnvironment } from "../helpers/env";
import { seedScore, seedUser } from "../helpers/fixtures";
import { TestBot } from "../helpers/harness";

const env = setupTestEnvironment();

const CHAT_ID = 7_001;
const GROUP_CHAT_ID = -1_000_007_001;

async function seedAda(
  options: {
    chatId?: string;
    score?: number;
    wordLength?: "4" | "5" | "6";
  } = {},
) {
  await seedUser(env.db, { id: "4242", name: "Ada Lovelace", username: "ada" });
  await seedScore(env.db, {
    userId: "4242",
    chatId: options.chatId ?? String(CHAT_ID),
    score: options.score ?? 42,
    wordLength: options.wordLength ?? "5",
  });
}

function keyboardCallbacks(bot: TestBot): string[] {
  return bot.calls
    .flatMap((call) => call.payload.reply_markup?.inline_keyboard ?? [])
    .flat()
    .map((button: any) => String(button.callback_data ?? ""));
}

describe("/leaderboard", () => {
  test("renders global scores in private chats", async () => {
    await seedAda({ score: 42 });
    await seedUser(env.db, {
      id: "5252",
      name: "Grace Hopper",
      username: "grace",
    });
    await seedScore(env.db, {
      userId: "5252",
      chatId: String(CHAT_ID),
      score: 100,
    });

    const bot = new TestBot();
    await bot.sendText("/leaderboard");

    const text = bot.lastText() ?? "";
    expect(text).toContain("Global");
    expect(text).toContain("Grace");
    expect(text).toContain("100");
    expect(text).toContain("Ada");
    expect(bot.errors).toHaveLength(0);
  });

  test("defaults to the current group", async () => {
    await seedUser(env.db, {
      id: "5151",
      name: "Group Player",
      username: "gp",
    });
    await seedScore(env.db, {
      userId: "5151",
      chatId: String(GROUP_CHAT_ID),
      score: 77,
    });
    await seedUser(env.db, { id: "6262", name: "Other Group", username: "og" });
    await seedScore(env.db, { userId: "6262", chatId: "-1002", score: 999 });

    const bot = new TestBot();
    await bot.sendText("/leaderboard", { chatType: "group" });

    const text = bot.lastText() ?? "";
    expect(text).toContain("Group");
    expect(text).toContain("Group Player");
    expect(text).not.toContain("Other Group");
  });

  test("honours scope, period and length filters", async () => {
    await seedAda({ score: 12, wordLength: "4" });

    const bot = new TestBot();
    await bot.sendText("/leaderboard global all 4");

    expect(bot.lastText()).toContain("Ada");
    expect(keyboardCallbacks(bot)).toContain("leaderboard global all 4");
  });

  test("excludes banned users", async () => {
    await seedAda();
    await env.db.insertInto("bannedUsers").values({ userId: "4242" }).execute();

    const bot = new TestBot();
    await bot.sendText("/leaderboard");

    expect(bot.lastText()).not.toContain("Ada");
  });

  test("blocks game topics that are not designated for play", async () => {
    await env.db
      .insertInto("chatGameTopics")
      .values({ chatId: String(GROUP_CHAT_ID), topicId: "5", name: "Play" })
      .execute();

    const bot = new TestBot();
    await bot.sendText("/leaderboard", {
      chatType: "forum",
      messageThreadId: 9,
    });

    expect(bot.lastText()).toContain("not set for the game");
  });
});

describe("/score", () => {
  test("shows the caller's own score with rank and streaks", async () => {
    await seedAda({ score: 55 });
    await env.db
      .insertInto("userStats")
      .values({
        userId: "4242",
        currentStreak: 3,
        highestStreak: 7,
      })
      .execute();

    const bot = new TestBot();
    await bot.sendText("/score", { id: 4242 });

    const text = bot.lastText() ?? "";
    expect(text).toContain("55");
    expect(text).toContain("#1");
    expect(text).toContain("Current Streak:</b> 3");
    expect(text).toContain("Highest Streak:</b> 7");
  });

  test("finds another user by @mention", async () => {
    await seedAda({ score: 21 });

    const bot = new TestBot();
    await bot.sendText("/score @ada");

    expect(bot.lastText()).toContain("Ada");
    expect(bot.lastText()).toContain("21");
  });

  test("falls back from group to global when the group has no scores", async () => {
    await seedAda({ chatId: String(CHAT_ID), score: 33 });

    const bot = new TestBot();
    await bot.sendText("/score", { chatType: "group", id: 4242 });

    expect(bot.lastText()).toContain("globally");
  });

  test("honours an explicitly requested word length", async () => {
    await seedAda({ score: 18, wordLength: "4" });

    const bot = new TestBot();
    await bot.sendText("/score 4", { id: 4242 });

    expect(keyboardCallbacks(bot)).toContain("score 4242 global today 4");
    expect(bot.lastText()).toContain("18");
  });

  test("keeps the historical /score default of 5 letters", async () => {
    await seedAda({ score: 18, wordLength: "4" });

    const bot = new TestBot();
    await bot.sendText("/score", { id: 4242 });

    expect(keyboardCallbacks(bot)).toContain("score 4242 global all 5");
    expect(bot.lastText()).toContain("no scores recorded");
  });

  test("explains when the caller has no scores at all", async () => {
    const bot = new TestBot();
    await bot.sendText("/score");

    const text = bot.lastText() ?? "";
    expect(text).toContain("no scores recorded yet");
    expect(keyboardCallbacks(bot).length).toBeGreaterThan(0);
  });

  test("reports an unknown target", async () => {
    const bot = new TestBot();
    await bot.sendText("/score @ghost");

    expect(bot.lastText()).toBe("User not found.");
  });
});

describe("leaderboard callbacks", () => {
  test("edits the message with the selected filter", async () => {
    await seedAda({ score: 61 });

    const bot = new TestBot();
    await bot.click("leaderboard global month 5");

    const edit = bot.lastCall("editMessageText");
    expect(edit?.payload.text).toContain("Global");
    expect(edit?.payload.parse_mode).toBe("HTML");
    expect(bot.lastCall("answerCallbackQuery")).toBeDefined();
  });

  test("ignores malformed filter payloads", async () => {
    const bot = new TestBot();
    await bot.click("leaderboard global month nope");

    expect(bot.callsTo("editMessageText")).toHaveLength(0);
    expect(bot.callsTo("answerCallbackQuery")).toHaveLength(1);
  });
});

describe("score callbacks", () => {
  test("lists duplicate usernames for selection", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada One", username: "ada" });
    await seedUser(env.db, { id: "4343", name: "Ada Two", username: "ada" });

    const bot = new TestBot();
    await bot.click("score_list ada");

    const edit = bot.lastCall("editMessageText");
    expect(edit?.payload.text).toContain("Multiple Users Found");
    const buttons = edit?.payload.reply_markup.inline_keyboard.flat() ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons[1].callback_data).toBe("score_select 4343 ada");
  });

  test("alerts when no user owns the username", async () => {
    const bot = new TestBot();
    await bot.click("score_list ghost");

    expect(bot.lastCall("answerCallbackQuery")?.payload).toMatchObject({
      text: "No users found with this username.",
      show_alert: true,
    });
  });

  test("shows a selected user's score", async () => {
    await seedAda({ score: 44 });

    const bot = new TestBot();
    await bot.click("score_select 4242 ada");

    expect(bot.lastCall("editMessageText")?.payload.text).toContain("44");
    expect(bot.lastCall("answerCallbackQuery")).toBeDefined();
  });

  test("keeps the historical score_select bug: word length is ignored", async () => {
    // The user only has 4-letter scores, so smart defaults pick 4. The
    // callback intentionally omits the length when fetching scores, falling
    // back to 5 and reporting no results.
    await seedAda({ score: 25, wordLength: "4" });

    const bot = new TestBot();
    await bot.click("score_select 4242 ada");

    expect(bot.lastCall("editMessageText")?.payload.text).toContain(
      "no scores recorded",
    );
    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toBe(
      "No scores found for the current filter.",
    );
  });

  test("supports the direct score callback with explicit filters", async () => {
    await seedAda({ score: 88 });

    const bot = new TestBot();
    await bot.click("score 4242 global today 5");

    expect(bot.lastCall("editMessageText")?.payload.text).toContain("88");
  });

  test("reports an empty filter selection", async () => {
    await seedAda({ score: 88 });

    const bot = new TestBot();
    await bot.click("score 4242 global today 6");

    expect(bot.lastCall("editMessageText")?.payload.text).toContain(
      "hasn't played today",
    );
    expect(bot.lastCall("answerCallbackQuery")?.payload.text).toBe(
      "No scores found for this period.",
    );
  });

  test("reports an unknown user", async () => {
    const bot = new TestBot();
    await bot.click("score 999999 global today 5");

    expect(bot.lastCall("answerCallbackQuery")?.payload).toMatchObject({
      text: "User not found.",
      show_alert: true,
    });
  });
});
