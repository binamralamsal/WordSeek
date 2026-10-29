import { describe, expect, test } from "bun:test";

import { Context } from "grammy";

import { bot as configBot } from "#/config/bot";
import { redisKeys } from "#/core/redis-keys.constants";
import { broadcastCommand } from "#/features/admin/broadcast/broadcast.command";
import {
  type BroadcastState,
  getBroadcastState,
  saveBroadcastState,
} from "#/features/admin/broadcast/broadcast-state.service";
import type { Message } from "grammy/types";

import { flushAsyncWork, setupTestEnvironment } from "../helpers/env";
import {
  TestBot,
  TEST_BOT_INFO,
  privateMessageUpdate,
} from "../helpers/harness";

const envState = setupTestEnvironment();

const ADMIN_ID = 999;
const COPY_CHATS = [-9_001, -9_002];

const copied: number[] = [];
const edits: string[] = [];
let failingChat: number | null = null;

configBot.api.config.use((_prev, method, payload) => {
  const body = payload as Record<string, any>;

  if (method === "copyMessage") {
    if (body.chat_id === failingChat) {
      return Promise.reject(new Error("Forbidden: bot was kicked"));
    }

    copied.push(Number(body.chat_id));
    return Promise.resolve({
      ok: true,
      result: { message_id: 4_242 },
    }) as never;
  }

  if (method === "editMessageText") {
    edits.push(String(body.text ?? ""));
    return Promise.resolve({ ok: true, result: true }) as never;
  }

  return Promise.resolve({ ok: true, result: true }) as never;
});

function broadcastSource(): Message {
  return {
    message_id: 3_210,
    date: Math.floor(Date.now() / 1000),
    chat: { id: ADMIN_ID, type: "private", first_name: "Admin" },
    from: { id: ADMIN_ID, is_bot: false, first_name: "Admin" },
    text: "Announcement",
  };
}

const sampleState: BroadcastState = {
  messageId: 3_210,
  chatId: ADMIN_ID,
  totalChats: 2,
  currentIndex: 1,
  successCount: 1,
  blockedCount: 0,
  deletedCount: 0,
  unknownErrorCount: 0,
  startTime: Date.now() - 2_000,
  statusMessageId: 8_001,
  statusChatId: ADMIN_ID,
};

async function seedChats() {
  for (const id of COPY_CHATS) {
    await envState.db
      .insertInto("broadcastChats")
      .values({ id: String(id), name: `Chat ${id}`, username: null })
      .execute();
  }
}

async function runBroadcast(bot: TestBot, replyTo?: Message) {
  const ctx = new Context(
    privateMessageUpdate("/broadcast", { id: ADMIN_ID, replyTo }),
    bot.bot.api,
    TEST_BOT_INFO,
  );

  await broadcastCommand.middleware()(ctx, async () => {});
}

describe("/broadcast", () => {
  test("copies the replied message to every recorded chat", async () => {
    await seedChats();
    copied.length = 0;
    failingChat = null;

    const bot = new TestBot();
    await runBroadcast(bot, broadcastSource());

    expect(copied.sort()).toEqual([...COPY_CHATS].sort());
    expect(edits.at(-1)).toContain("Broadcast completed!");
    expect(edits.at(-1)).toContain("Success: <code>2</code>");
    expect(await getBroadcastState()).toBeNull();
  });

  test("removes chats that blocked the bot", async () => {
    await seedChats();
    copied.length = 0;
    failingChat = COPY_CHATS[1]!;

    const bot = new TestBot();
    await runBroadcast(bot, broadcastSource());
    await flushAsyncWork();

    expect(edits.at(-1)).toContain("Total Failed: <code>1</code>");
    const remaining = await envState.db
      .selectFrom("broadcastChats")
      .select("id")
      .execute();
    expect(remaining.map((row) => row.id)).toEqual([String(COPY_CHATS[0])]);
    failingChat = null;
  });

  test("asks for a message to broadcast", async () => {
    const bot = new TestBot();
    await runBroadcast(bot);

    expect(bot.lastText()).toContain("No message to broadcast");
  });

  test("reports an empty audience", async () => {
    const bot = new TestBot();
    await runBroadcast(bot, broadcastSource());

    expect(bot.lastText()).toContain("Not enough users are recorded yet!");
    expect(await getBroadcastState()).toBeNull();
  });

  test("refuses to start while another broadcast is running", async () => {
    await saveBroadcastState(sampleState);

    const bot = new TestBot();
    await runBroadcast(bot, broadcastSource());

    expect(bot.lastText()).toContain("already in progress");
  });

  test("ignores non-admins and group chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/broadcast", {
      id: 7_001,
      replyTo: broadcastSource(),
    });
    await bot.sendText("/broadcast", {
      id: ADMIN_ID,
      chatType: "group",
      replyTo: broadcastSource(),
    });

    expect(bot.texts()).toHaveLength(0);
  });
});

describe("broadcast status commands", () => {
  test("reports progress", async () => {
    await saveBroadcastState(sampleState);

    const bot = new TestBot();
    await bot.sendText("/broadcast_status", { id: ADMIN_ID });

    expect(bot.lastText()).toContain("Broadcast in progress!");
    expect(bot.lastText()).toContain("1/2");
    expect(bot.lastText()).toContain("Success: <code>1</code>");
  });

  test("cancels a broadcast and releases the lock", async () => {
    await saveBroadcastState(sampleState);
    await envState.redis.set(redisKeys.broadcastLock, "1");

    const bot = new TestBot();
    await bot.sendText("/broadcast_cancel", { id: ADMIN_ID });

    expect(bot.lastText()).toContain("Broadcast cancelled!");
    expect(bot.lastText()).toContain("1/2");
    expect(await getBroadcastState()).toBeNull();
    expect(await envState.redis.get(redisKeys.broadcastLock)).toBeNull();
  });

  test("reports idle state for both commands", async () => {
    const bot = new TestBot();

    await bot.sendText("/broadcast_status", { id: ADMIN_ID });
    expect(bot.lastText()).toContain("No broadcast in progress");

    await bot.sendText("/broadcast_cancel", { id: ADMIN_ID });
    expect(bot.lastText()).toContain("No broadcast in progress");
  });

  test("is restricted to private admin chats", async () => {
    const bot = new TestBot();

    await bot.sendText("/broadcast_status", { id: 7_001 });
    await bot.sendText("/broadcast_cancel", {
      id: ADMIN_ID,
      chatType: "group",
    });

    expect(bot.texts()).toHaveLength(0);
  });
});
