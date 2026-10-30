import { describe, expect, test } from "bun:test";

import { setupTestEnvironment } from "../helpers/env";
import { seedChatTopic, seedUser } from "../helpers/fixtures";
import { TestBot } from "../helpers/harness";

const env = setupTestEnvironment();

const ADMIN_ID = 999;
const CHAT_ID = -1_000_000_999;
const TOPIC_ID = 5;

function forum(bot: TestBot) {
  bot.chatMemberStatus = "administrator";
  return bot;
}

describe("game topic settings", () => {
  test("sets the current forum topic for games", async () => {
    const bot = forum(new TestBot());

    await bot.sendText("/setgametopic", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });

    expect(bot.lastText()).toContain("will now use this topic");
    expect(
      await env.db
        .selectFrom("chatGameTopics")
        .select(["chatId", "topicId"])
        .where("chatId", "=", String(CHAT_ID))
        .executeTakeFirst(),
    ).toMatchObject({ chatId: String(CHAT_ID), topicId: String(TOPIC_ID) });
  });

  test("rejects non-forum chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/setgametopic", { chatType: "group", id: ADMIN_ID });

    expect(bot.lastText()).toContain("only be used in forum groups");
  });

  test("requires group admin rights", async () => {
    const bot = new TestBot();
    bot.chatMemberStatus = "member";

    await bot.sendText("/setgametopic", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
    });

    expect(bot.lastText()).toBe("Only admins can use this command.");
  });

  test("unsets the current game topic", async () => {
    await seedChatTopic(env.db, {
      chatId: String(CHAT_ID),
      topicId: String(TOPIC_ID),
    });
    const bot = forum(new TestBot());

    await bot.sendText("/unsetgametopic", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });

    expect(bot.lastText()).toContain("won't use this topic");
    expect(
      await env.db.selectFrom("chatGameTopics").selectAll().execute(),
    ).toHaveLength(0);
  });
});

describe("word length restrictions", () => {
  test("updates allowed lengths and default", async () => {
    await seedChatTopic(env.db, {
      chatId: String(CHAT_ID),
      topicId: String(TOPIC_ID),
      allowedLengths: [5, 4, 6],
    });
    const bot = forum(new TestBot());

    await bot.sendText("/allowonlylen 4 5", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });

    expect(bot.lastText()).toContain("Allowed word lengths updated.");
    expect(bot.lastText()).toContain("Default length: 4");

    const row = await env.db
      .selectFrom("chatGameTopics")
      .select(["allowedLengths"])
      .where("chatId", "=", String(CHAT_ID))
      .executeTakeFirst();
    expect(row?.allowedLengths).toEqual([4, 5]);
  });

  test("validates arguments and configuration", async () => {
    const bot = forum(new TestBot());

    await bot.sendText("/allowonlylen", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("Usage: /allowonlylen");

    await bot.sendText("/allowonlylen 9", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toBe("Allowed lengths are only: 4, 5, 6");

    await bot.sendText("/allowonlylen 4", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("not set for the game");
  });

  test("rejects non-forum chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/allowonlylen 4", { chatType: "group", id: ADMIN_ID });

    expect(bot.lastText()).toContain("only be used in forum groups");
  });
});

describe("topic recreation", () => {
  test("toggles recreation on and off", async () => {
    await seedChatTopic(env.db, {
      chatId: String(CHAT_ID),
      topicId: String(TOPIC_ID),
    });
    const bot = forum(new TestBot());

    await bot.sendText("/recreatetopic on", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("turned ON");

    let row = await env.db
      .selectFrom("chatGameTopics")
      .select("shouldRecreateOnExpire")
      .where("chatId", "=", String(CHAT_ID))
      .executeTakeFirst();
    expect(row?.shouldRecreateOnExpire).toBe(true);

    await bot.sendText("/recreatetopic off", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("turned OFF");

    row = await env.db
      .selectFrom("chatGameTopics")
      .select("shouldRecreateOnExpire")
      .where("chatId", "=", String(CHAT_ID))
      .executeTakeFirst();
    expect(row?.shouldRecreateOnExpire).toBe(false);
  });

  test("explains general topics and missing configuration", async () => {
    const bot = forum(new TestBot());

    await bot.sendText("/recreatetopic on", {
      chatType: "forum",
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("General topics can't expire");

    await bot.sendText("/recreatetopic", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("Please specify 'on' or 'off'");

    await bot.sendText("/recreatetopic maybe", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("Please specify 'on' or 'off'");

    await bot.sendText("/recreatetopic on", {
      chatType: "forum",
      messageThreadId: TOPIC_ID,
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("No game topic set for this topic");
  });
});

describe("/seekauth", () => {
  test("authorizes, lists and removes a user", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    const bot = forum(new TestBot());

    await bot.sendText("/seekauth @ada", {
      chatType: "group",
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("is now authorized to end the game");

    await bot.sendText("/seekauth list", { chatType: "group", id: ADMIN_ID });
    expect(bot.lastText()).toContain("Authorized Users");
    expect(bot.lastText()).toContain("Ada");

    await bot.sendText("/seekauth remove @ada", {
      chatType: "group",
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toContain("is no longer authorized");

    await bot.sendText("/seekauth remove @ada", {
      chatType: "group",
      id: ADMIN_ID,
    });
    expect(bot.lastText()).toBe("❌ This user is not authorized.");
  });

  test("reports an empty list", async () => {
    const bot = forum(new TestBot());

    await bot.sendText("/seekauth list", { chatType: "group", id: ADMIN_ID });

    expect(bot.lastText()).toContain("No authorized users");
  });

  test("denies regular members", async () => {
    const bot = new TestBot();
    bot.chatMemberStatus = "member";

    await bot.sendText("/seekauth @ada", { chatType: "group", id: 7001 });

    expect(bot.lastText()).toContain("don't have permission");
  });

  test("allows system admins even without group admin rights", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada", username: "ada" });
    const bot = new TestBot();
    bot.chatMemberStatus = "member";

    await bot.sendText("/seekauth @ada", { chatType: "group", id: ADMIN_ID });

    expect(bot.lastText()).toContain("is now authorized");
  });

  test("reports unknown users", async () => {
    const bot = forum(new TestBot());

    await bot.sendText("/seekauth @ghost", { chatType: "group", id: ADMIN_ID });

    expect(bot.lastText()).toContain("Could not identify the user");
  });
});
