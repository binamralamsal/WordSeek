import { afterEach, describe, expect, test } from "bun:test";

import {
  BotError,
  Context,
  GrammyError,
  HttpError,
} from "grammy";
import type { Message, Update } from "grammy/types";

import { bot as configBot } from "#/config/bot";
import { env } from "#/config/env";
import { redisKeys } from "#/core/redis-keys.constants";
import { errorHandler } from "#/core/middleware/error-handler.middleware";
import {
  resetSystemLogState,
} from "#/core/logging/system-log.service";

import { flushAsyncWork, setupTestEnvironment } from "../helpers/env";
import { seedChatTopic, seedUser } from "../helpers/fixtures";
import {
  TestBot,
  TEST_BOT_INFO,
  forumMessageUpdate,
  forumTopicEditedUpdate,
  groupMessageUpdate,
  myChatMemberUpdate,
} from "../helpers/harness";

const envState = setupTestEnvironment();

const ADMIN_ID = 999;
const PLAYER_ID = 7_001;
const GROUP_ID = -1_000_000_000 - PLAYER_ID;
const LOGS_CHANNEL = 555;

const systemCalls: { method: string; payload: Record<string, any> }[] = [];

configBot.api.config.use((_prev, method, payload) => {
  systemCalls.push({
    method: method as string,
    payload: payload as Record<string, any>,
  });

  return Promise.resolve({
    ok: true,
    result: { message_id: 8_888, date: 0, chat: { id: 1, type: "channel" } },
  }) as never;
});

afterEach(() => {
  env.SYSTEM_LOG_CHANNEL = undefined;
  systemCalls.length = 0;
  resetSystemLogState();
});

function channelPostUpdate(text: string, chatId = -1_009): Update {
  return {
    update_id: 90_001,
    channel_post: {
      message_id: 8_001,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: "channel", title: "News" },
      text,
    },
  } as Update;
}

function chatMemberUpdate(): Update {
  const user = { id: 4_242, is_bot: false, first_name: "Ada" };

  return {
    update_id: 90_002,
    chat_member: {
      chat: { id: GROUP_ID, type: "supergroup", title: "Test Chat" },
      from: user,
      date: Math.floor(Date.now() / 1000),
      old_chat_member: { status: "member", user },
      new_chat_member: { status: "administrator", user },
    },
  } as unknown as Update;
}

function editedUpdate(text: string, chatType: "private" | "group" = "group"): Update {
  const base =
    chatType === "private"
      ? ({ update_id: 90_003, message: {} } as unknown as Update)
      : groupMessageUpdate(text);
  const message = base.message as Message;

  return {
    update_id: 90_004,
    edited_message: { ...message, text, edit_date: Math.floor(Date.now() / 1000) },
  } as Update;
}

describe("sync user/chat middleware", () => {
  test("stores the sender and the chat", async () => {
    const bot = new TestBot();

    await bot.sendText("hello", { chatType: "group" });
    await flushAsyncWork();

    expect(
      await envState.db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", String(PLAYER_ID))
        .executeTakeFirst(),
    ).toMatchObject({ id: String(PLAYER_ID), name: "Tester" });

    expect(
      await envState.db
        .selectFrom("broadcastChats")
        .selectAll()
        .where("id", "=", String(GROUP_ID))
        .executeTakeFirst(),
    ).toMatchObject({ id: String(GROUP_ID), name: "Test Chat" });
  });

  test("skips channel chats", async () => {
    const bot = new TestBot();

    await bot.send(channelPostUpdate("hello"));
    await flushAsyncWork();

    expect(
      await envState.db
        .selectFrom("broadcastChats")
        .selectAll()
        .where("id", "=", "-1009")
        .executeTakeFirst(),
    ).toBeUndefined();
  });
});

describe("banned users middleware", () => {
  test("blocks private messages with an appeal button", async () => {
    await seedUser(envState.db, { id: String(PLAYER_ID) });
    await envState.db
      .insertInto("bannedUsers")
      .values({ userId: String(PLAYER_ID) })
      .execute();

    const bot = new TestBot();
    await bot.sendText("/start", { id: PLAYER_ID });

    expect(bot.lastText()).toContain("You have been banned");
    const buttons =
      bot.lastCall("sendMessage")?.payload.reply_markup.inline_keyboard.flat() ??
      [];
    expect(buttons[0].url).toBe("t.me/binamralamsal");
  });

  test("stays silent in groups unless the bot is addressed", async () => {
    await seedUser(envState.db, { id: String(PLAYER_ID) });
    await envState.db
      .insertInto("bannedUsers")
      .values({ userId: String(PLAYER_ID) })
      .execute();

    const bot = new TestBot();
    await bot.sendText("/start", { id: PLAYER_ID, chatType: "group" });
    expect(bot.texts()).toHaveLength(0);

    const botMessage: Message = {
      message_id: 700,
      date: Math.floor(Date.now() / 1000),
      chat: { id: GROUP_ID, type: "supergroup", title: "Test Chat" },
      from: {
        id: TEST_BOT_INFO.id,
        is_bot: true,
        first_name: "WordSeek",
        username: "wordseek_test_bot",
      },
      text: "Reply to me",
    };

    await bot.sendText("hey", {
      id: PLAYER_ID,
      chatType: "group",
      replyTo: botMessage,
    });

    expect(bot.lastText()).toContain("You have been banned");
  });
});

describe("topic edited middleware", () => {
  test("renames tracked game topics", async () => {
    await seedChatTopic(envState.db, {
      chatId: String(GROUP_ID),
      topicId: "5",
      name: "Old Name",
    });

    const bot = new TestBot();
    await bot.send(
      forumTopicEditedUpdate({
        chatId: GROUP_ID,
        messageThreadId: 5,
        name: "New Name",
        iconCustomEmojiId: "123",
      }),
    );

    const row = await envState.db
      .selectFrom("chatGameTopics")
      .selectAll()
      .where("chatId", "=", String(GROUP_ID))
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("New Name");
    expect(row.iconCustomEmojiId).toBe("123");
  });

  test("ignores topics without changes", async () => {
    await seedChatTopic(envState.db, {
      chatId: String(GROUP_ID),
      topicId: "5",
      name: "Stays",
    });

    const bot = new TestBot();
    await bot.send(
      forumTopicEditedUpdate({ chatId: GROUP_ID, messageThreadId: 5 }),
    );

    const row = await envState.db
      .selectFrom("chatGameTopics")
      .select("name")
      .where("chatId", "=", String(GROUP_ID))
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Stays");
  });
});

describe("bot membership middleware", () => {
  test("welcomes the bot to groups", async () => {
    const bot = new TestBot();

    await bot.send(myChatMemberUpdate("member", { chatId: GROUP_ID }));

    expect(bot.lastText()).toContain("Thanks for adding WordSeek");
    const buttons =
      bot.lastCall("sendMessage")?.payload.reply_markup.inline_keyboard.flat() ??
      [];
    expect(buttons.length).toBeGreaterThan(0);
  });

  test("removes broadcast chats when the bot leaves", async () => {
    await envState.db
      .insertInto("broadcastChats")
      .values({ id: String(GROUP_ID), name: "Test Chat", username: null })
      .execute();

    const bot = new TestBot();
    await bot.send(myChatMemberUpdate("kicked", { chatId: GROUP_ID }));

    expect(
      await envState.db
        .selectFrom("broadcastChats")
        .selectAll()
        .where("id", "=", String(GROUP_ID))
        .executeTakeFirst(),
    ).toBeUndefined();
  });
});

describe("suspicious activity tracking", () => {
  test("alerts and forwards suspicious messages to the logs channel", async () => {
    const bot = new TestBot();

    await bot.sendText("/sws start", { id: PLAYER_ID });

    const alerts = bot
      .callsTo("sendMessage")
      .filter((call) => call.payload.chat_id === LOGS_CHANNEL);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.payload.text).toContain("SUSPICIOUS ACTIVITY DETECTED");
    expect(alerts[0]!.payload.text).toContain("Contains /sws command");

    const forwarded = bot
      .callsTo("forwardMessage")
      .filter((call) => call.payload.chat_id === LOGS_CHANNEL);
    expect(forwarded).toHaveLength(1);
  });

  test("falls back to admins when no logs channel is configured", async () => {
    const previous = env.LOGS_CHANNEL;
    env.LOGS_CHANNEL = undefined;

    try {
      const bot = new TestBot();
      await bot.sendText("/wordhck", { id: PLAYER_ID });

      const alerts = bot
        .callsTo("sendMessage")
        .filter((call) => call.payload.chat_id === ADMIN_ID);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.payload.text).toContain("Contains /wordhck command");
    } finally {
      env.LOGS_CHANNEL = previous;
    }
  });

  test("detects greeting combos", async () => {
    const bot = new TestBot();

    await bot.sendText("hello baby", { id: PLAYER_ID });
    await bot.sendText("byee", { id: PLAYER_ID });

    const combo = bot
      .callsTo("sendMessage")
      .filter((call) =>
        String(call.payload.text ?? "").includes("GREETING COMBO DETECTED"),
      );
    expect(combo).toHaveLength(1);
    expect(combo[0]!.payload.text).toContain('"Hello Baby": 1x');
    expect(combo[0]!.payload.text).toContain('"Byee": 1x');
  });

  test("flags suspicious edits", async () => {
    const bot = new TestBot();

    await bot.send(editedUpdate("running an auto-player now"));

    const alert = bot.callsTo("sendMessage").at(-1);
    expect(alert?.payload.text).toContain(
      "Edited message contains auto-player keyword",
    );
  });

  test("does not treat a lone apex mention as suspicious", async () => {
    const bot = new TestBot();

    await bot.sendText("apex legends is fun", { id: PLAYER_ID });

    expect(
      bot
        .callsTo("sendMessage")
        .filter((call) => call.payload.chat_id === LOGS_CHANNEL),
    ).toHaveLength(0);
  });
});

describe("tracked chat forwarding", () => {
  test("forwards new messages", async () => {
    await envState.redis.set(redisKeys.tracking(GROUP_ID), "999");

    const bot = new TestBot();
    await bot.sendText("just chatting", {
      id: PLAYER_ID,
      chatType: "group",
    });

    expect(
      bot
        .callsTo("forwardMessage")
        .find((call) => call.payload.chat_id === ADMIN_ID),
    ).toMatchObject({
      payload: {
        chat_id: ADMIN_ID,
        from_chat_id: GROUP_ID,
      },
    });
  });

  test("reports edits, channel posts, button clicks and membership changes", async () => {
    await envState.redis.set(redisKeys.tracking(GROUP_ID), "999");
    await envState.redis.set(redisKeys.tracking(-1_009), "999");
    await envState.redis.set(redisKeys.tracking(PLAYER_ID), "999");

    const bot = new TestBot();

    await bot.send(editedUpdate("edited text"));
    expect(
      bot.callsTo("sendMessage").at(-1)?.payload.text,
    ).toContain("Message edited");

    await bot.send(channelPostUpdate("hello"));
    const channelForward = bot
      .callsTo("forwardMessage")
      .find((call) => call.payload.from_chat_id === -1_009);
    expect(channelForward?.payload).toMatchObject({
      chat_id: ADMIN_ID,
      from_chat_id: -1_009,
    });

    await bot.click("wh:correct:A", { id: PLAYER_ID });
    expect(
      bot
        .callsTo("sendMessage")
        .find((call) =>
          String(call.payload.text ?? "").includes("Button clicked"),
        )?.payload.text,
    ).toContain("Button clicked");

    await bot.send(chatMemberUpdate());
    expect(
      bot.callsTo("sendMessage").at(-1)?.payload.text,
    ).toContain("Member status change");
  });
});

describe("error handler", () => {
  function contextFor(bot: TestBot, update: Update): Context {
    return new Context(update, bot.bot.api, TEST_BOT_INFO);
  }

  test("leaves a group that denies text permissions", async () => {
    const bot = new TestBot();
    const ctx = contextFor(
      bot,
      groupMessageUpdate("hello", { id: PLAYER_ID }),
    );

    const error = new GrammyError(
      "Call to 'sendMessage' failed!",
      {
        ok: false,
        error_code: 403,
        description:
          "Bad Request: not enough rights to send text messages to the chat",
      },
      "sendMessage",
      {},
    );

    await errorHandler(new BotError(error, ctx));

    const leave = bot.lastCall("leaveChat");
    expect(leave?.payload).toMatchObject({ chat_id: GROUP_ID });
  });

  test("recreates an expired forum topic when configured", async () => {
    await seedChatTopic(envState.db, {
      chatId: String(GROUP_ID),
      topicId: "5",
      name: "WordSeek",
      shouldRecreateOnExpire: true,
    });

    const bot = new TestBot();
    const ctx = contextFor(
      bot,
      forumMessageUpdate("hello", {
        id: PLAYER_ID,
        messageThreadId: 5,
      }),
    );

    const error = new GrammyError(
      "Call to 'sendMessage' failed!",
      {
        ok: false,
        error_code: 400,
        description: "Bad Request: message thread not found",
      },
      "sendMessage",
      {},
    );

    await errorHandler(new BotError(error, ctx));

    expect(bot.callsTo("createForumTopic")).toHaveLength(1);
    expect(bot.callsTo("deleteForumTopic")).toHaveLength(1);

    const topics = await envState.db
      .selectFrom("chatGameTopics")
      .selectAll()
      .where("chatId", "=", String(GROUP_ID))
      .execute();
    expect(topics).toHaveLength(1);
    expect(topics[0]!.topicId).not.toBe("5");
    expect(topics[0]!.shouldRecreateOnExpire).toBe(true);
    expect(
      bot.callsTo("sendMessage").at(-1)?.payload.text,
    ).toContain("Topic recreated successfully");
  });

  test("does not recreate topics that opt out", async () => {
    await seedChatTopic(envState.db, {
      chatId: String(GROUP_ID),
      topicId: "5",
      shouldRecreateOnExpire: false,
    });

    const bot = new TestBot();
    const ctx = contextFor(
      bot,
      forumMessageUpdate("hello", {
        id: PLAYER_ID,
        messageThreadId: 5,
      }),
    );

    const error = new GrammyError(
      "Call to 'sendMessage' failed!",
      {
        ok: false,
        error_code: 400,
        description: "Bad Request: message thread not found",
      },
      "sendMessage",
      {},
    );

    await errorHandler(new BotError(error, ctx));

    expect(bot.callsTo("createForumTopic")).toHaveLength(0);
    expect(
      await envState.db.selectFrom("chatGameTopics").selectAll().execute(),
    ).toHaveLength(1);
  });

  test("reports HTTP failures to the system log channel, not the logs channel", async () => {
    env.SYSTEM_LOG_CHANNEL = 777;
    resetSystemLogState();

    const bot = new TestBot();
    const ctx = contextFor(bot, groupMessageUpdate("hello", { id: PLAYER_ID }));

    await errorHandler(
      new BotError(new HttpError("Network request failed", new Error("boom")), ctx),
    );

    const sent = systemCalls.filter((call) => call.method === "sendMessage");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload.chat_id).toBe(777);
    expect(sent[0]!.payload.text).toContain("Could not contact Telegram");

    // Duplicate reports are suppressed inside the dedupe window.
    await errorHandler(
      new BotError(new HttpError("Network request failed", new Error("boom")), ctx),
    );
    expect(
      systemCalls.filter((call) => call.method === "sendMessage"),
    ).toHaveLength(1);
  });

  test("does not throw for unknown errors without a system channel", async () => {
    const bot = new TestBot();
    const ctx = contextFor(bot, groupMessageUpdate("hello", { id: PLAYER_ID }));

    await errorHandler(new BotError(new Error("boom"), ctx));

    expect(systemCalls).toHaveLength(0);
  });
});
