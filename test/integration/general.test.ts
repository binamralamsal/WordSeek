import { describe, expect, test } from "bun:test";
import type { Message } from "grammy/types";

import { setupTestEnvironment } from "../helpers/env";
import { TestBot } from "../helpers/harness";
import { parseRichButtons } from "../helpers/rich-message";

setupTestEnvironment();

function repliedMessage(): Message {
  return {
    message_id: 321,
    date: Math.floor(Date.now() / 1000),
    chat: {
      id: 7_001,
      type: "private",
      first_name: "Tester",
    },
    from: {
      id: 4_242,
      is_bot: false,
      first_name: "Ada",
      last_name: "Lovelace",
      username: "ada",
    },
    text: "hello there",
  };
}

function richTexts(bot: TestBot): string[] {
  return bot.calls
    .filter(
      (call) =>
        call.method === "sendRichMessage" ||
        (call.method === "editMessageText" && call.payload.rich_message),
    )
    .map((call) => String(call.payload.rich_message?.html ?? ""));
}

function lastRichHtml(bot: TestBot): string {
  return richTexts(bot).at(-1) ?? "";
}

describe("/start", () => {
  test("welcomes the user with a rich banner message and action buttons", async () => {
    const bot = new TestBot();

    await bot.sendText("/start");

    expect(bot.errors).toHaveLength(0);

    const rich = bot.lastCall("sendRichMessage");
    const html = String(rich?.payload.rich_message?.html ?? "");
    expect(html).toContain("Welcome to WordSeek");
    expect(html).toContain("Quick start");

    const media = rich?.payload.rich_message?.media ?? [];
    expect(media[0]?.id).toBe("banner");

    const buttons = parseRichButtons(html);
    expect(buttons.some((button) => button.text.includes("Add me"))).toBe(true);
    expect(buttons.some((button) => button.data === "help_howto")).toBe(true);
    expect(rich?.payload.reply_markup).toBeUndefined();
  });
});

describe("/help", () => {
  test("sends the rich how-to-play message with embedded buttons", async () => {
    const bot = new TestBot();

    await bot.sendText("/help");

    const html = lastRichHtml(bot);
    expect(html).toContain("How to Play WordSeek");
    expect(html).toContain("tg-button-row");

    const buttons = parseRichButtons(html);
    expect(buttons.some((button) => button.data === "help_scores")).toBe(true);
    expect(
      buttons.some((button) => button.text.toLowerCase().includes("github")),
    ).toBe(false);
    expect(html).toContain("github.com/binamralamsal/WordSeek");
    // Regular users do not get the admin-only section.
    expect(buttons.some((button) => button.data === "help_admin")).toBe(false);
    expect(
      bot.lastCall("sendRichMessage")?.payload.reply_markup,
    ).toBeUndefined();
  });

  test("shows the admin section to system admins in private chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/help", { id: 999 });

    const buttons = parseRichButtons(lastRichHtml(bot));
    expect(buttons.some((button) => button.data === "help_admin")).toBe(true);
  });

  test("hides the admin section outside private chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/help", { id: 999, chatType: "group" });

    const buttons = parseRichButtons(lastRichHtml(bot));
    expect(buttons.some((button) => button.data === "help_admin")).toBe(false);
  });
});

describe("help callbacks", () => {
  test("switches to the scores section", async () => {
    const bot = new TestBot();

    await bot.click("help_scores");

    const html = richTexts(bot).join("\n");
    expect(html).toContain("Leaderboard");
    expect(bot.lastCall("answerCallbackQuery")).toBeDefined();
  });

  test("denies the admin section to regular users", async () => {
    const bot = new TestBot();

    await bot.click("help_admin");

    const answer = bot.lastCall("answerCallbackQuery");
    expect(answer?.payload.text).toBe(
      "You don't have permission to view this.",
    );
    expect(answer?.payload.show_alert).toBe(true);
    expect(richTexts(bot)).toHaveLength(0);
  });

  test("acknowledges unknown buttons without replying", async () => {
    const bot = new TestBot();

    await bot.click("totally_unknown");

    expect(bot.callsTo("answerCallbackQuery")).toHaveLength(1);
    expect(bot.callsTo("sendMessage")).toHaveLength(0);
  });
});

describe("simple commands", () => {
  test("/myscore points to /score", async () => {
    const bot = new TestBot();

    await bot.sendText("/myscore");

    expect(bot.lastText()).toContain("/score");
  });

  test("/id shows the caller's own id in private chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/id");

    const text = bot.lastText() ?? "";
    expect(text).toContain("Your Telegram ID");
    expect(text).toContain("7001");
    expect(text).toContain("Tester");
  });

  test("/id is restricted to group administrators", async () => {
    const bot = new TestBot();

    await bot.sendText("/id", { chatType: "group" });

    expect(bot.lastText()).toContain("group administrators");
  });

  test("/id shows the command message and sender to group admins", async () => {
    const bot = new TestBot();
    bot.chatMemberStatus = "administrator";

    await bot.sendText("/id", { chatType: "group" });

    const text = bot.lastText() ?? "";
    expect(text).toContain("Your Telegram ID");
    expect(text).toContain("7001");
    expect(text).toContain("Test Chat");
    expect(text).toContain("Command Message");
  });

  test("/id renders message and user information for the replied message", async () => {
    const bot = new TestBot();

    await bot.sendText("/id", { replyTo: repliedMessage() });

    const text = bot.lastText() ?? "";
    expect(text).toContain("Message Information");
    expect(text).toContain("User Information");
    expect(text).toContain("4242");
    expect(text).toContain("Lovelace");
  });

  test("/startmatch is a harmless no-op", async () => {
    const bot = new TestBot();

    await bot.sendText("/startmatch");

    expect(bot.errors).toHaveLength(0);
    expect(bot.texts()).toHaveLength(0);
  });
});
