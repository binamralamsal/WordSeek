import { Api, Composer } from "grammy";

import { z } from "zod";

import { bot } from "../config/bot";
import { db } from "../config/db";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { BroadcastChat } from "../database-schemas";
import { formatDuration } from "../util/format-duration";

const composer = new Composer();

const broadcastStateSchema = z.object({
  messageId: z.number(),
  chatId: z.number(),
  totalChats: z.number(),
  currentIndex: z.number(),
  successCount: z.number(),
  blockedCount: z.number(),
  deletedCount: z.number(),
  unknownErrorCount: z.number(),
  startTime: z.number(),
  statusMessageId: z.number(),
  statusChatId: z.number(),
});

type BroadcastState = z.infer<typeof broadcastStateSchema>;

const BROADCAST_KEY = "broadcast:state";
const BROADCAST_LOCK_KEY = "broadcast:lock";

async function saveBroadcastState(state: BroadcastState) {
  await redis.set(BROADCAST_KEY, JSON.stringify(state), "EX", 86400);
}

async function getBroadcastState() {
  const data = await redis.get(BROADCAST_KEY);
  if (!data) return null;

  try {
    return broadcastStateSchema.parse(JSON.parse(data));
  } catch (error) {
    console.error("Invalid broadcast state in Redis:", error);
    return null;
  }
}

async function clearBroadcastState() {
  await redis.del(BROADCAST_KEY);
  await redis.del(BROADCAST_LOCK_KEY);
}

async function acquireBroadcastLock() {
  const result = await redis.set(BROADCAST_LOCK_KEY, "1", "EX", 3600, "NX");
  return result === "OK";
}

async function performBroadcast(
  chats: { id: string }[],
  state: BroadcastState,
) {
  for (let i = state.currentIndex; i < chats.length; i++) {
    const chat = chats[i];

    try {
      await bot.api.copyMessage(Number(chat.id), state.chatId, state.messageId);
      state.successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (
        errorMessage.includes("blocked") ||
        errorMessage.includes("bot was kicked")
      ) {
        state.blockedCount++;
      } else {
        state.unknownErrorCount++;
      }

      (async () => {
        try {
          await db
            .deleteFrom("broadcastChats")
            .where("id", "=", chat.id)
            .execute();
          state.deletedCount++;
        } catch (deleteError) {}
      })();
    }

    state.currentIndex = i + 1;
    await saveBroadcastState(state);

    if ((i + 1) % 50 === 0) {
      const elapsed = Date.now() - state.startTime;
      const estimatedTotal = (elapsed / (i + 1)) * chats.length;
      const estimatedRemaining = estimatedTotal - elapsed;

      try {
        await bot.api.editMessageText(
          state.statusChatId,
          state.statusMessageId,
          `<blockquote>Broadcast in progress!</blockquote>

Estimated time: <code>${formatDuration(estimatedRemaining)}</code>
Total Users: <code>${chats.length}</code>
Success: <code>${state.successCount}</code>
Blocked: <code>${state.blockedCount}</code>
Deleted: <code>${state.deletedCount}</code>`,
          { parse_mode: "HTML" },
        );
      } catch (editError) {}

      await sleep(10_000);
    }
  }

  const totalTime = Date.now() - state.startTime;
  const totalFailed = state.blockedCount + state.unknownErrorCount;

  try {
    await bot.api.editMessageText(
      state.statusChatId,
      state.statusMessageId,
      `<blockquote>Broadcast completed!</blockquote>

Completed in: <code>${formatDuration(totalTime)}</code>
Total Users: <code>${chats.length}</code>
Success: <code>${state.successCount}</code>
Blocked: <code>${state.blockedCount}</code>
Deleted: <code>${state.deletedCount}</code>
Total Failed: <code>${totalFailed}</code>`,
      { parse_mode: "HTML" },
    );
  } catch (editError) {}

  await clearBroadcastState();
}

composer.command("broadcast", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const { message } = ctx.update;
  const messageToForward = message?.reply_to_message?.message_id;

  if (!messageToForward || !message) {
    return ctx.reply(
      `<blockquote>No message to broadcast!</blockquote>

Please mention the message that you want to broadcast.`,
      { parse_mode: "HTML" },
    );
  }

  const existingState = await getBroadcastState();
  if (existingState) {
    return ctx.reply(
      `<blockquote>A broadcast is already in progress!</blockquote>

Progress: ${existingState.currentIndex}/${existingState.totalChats}
Use /broadcast_status to check status or /broadcast_cancel to cancel.`,
      { parse_mode: "HTML" },
    );
  }

  const lockAcquired = await acquireBroadcastLock();
  if (!lockAcquired) {
    return ctx.reply(
      `<blockquote>Failed to start broadcast. Please try again.</blockquote>`,
      { parse_mode: "HTML" },
    );
  }

  const chats = await db.selectFrom("broadcastChats").selectAll().execute();

  if (chats.length === 0) {
    await clearBroadcastState();
    return ctx.reply(
      `Not enough users are recorded yet!

<blockquote>Please try again later</blockquote>`,
      { parse_mode: "HTML" },
    );
  }

  const broadcastingMessage = await ctx.reply(
    `<blockquote>Broadcasting your message to ${chats.length} members</blockquote>`,
    { parse_mode: "HTML" },
  );

  const initialState: BroadcastState = {
    messageId: messageToForward,
    chatId: message.chat.id,
    totalChats: chats.length,
    currentIndex: 0,
    successCount: 0,
    blockedCount: 0,
    deletedCount: 0,
    unknownErrorCount: 0,
    startTime: Date.now(),
    statusMessageId: broadcastingMessage.message_id,
    statusChatId: broadcastingMessage.chat.id,
  };

  await saveBroadcastState(initialState);
  await performBroadcast(chats, initialState);
});

composer.command("broadcast_status", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const state = await getBroadcastState();
  if (!state) {
    return ctx.reply(`<blockquote>No broadcast in progress</blockquote>`, {
      parse_mode: "HTML",
    });
  }

  const elapsed = Date.now() - state.startTime;
  const estimatedTotal = (elapsed / state.currentIndex) * state.totalChats;
  const estimatedRemaining = estimatedTotal - elapsed;

  await ctx.reply(
    `<blockquote>Broadcast in progress!</blockquote>

Progress: <code>${state.currentIndex}/${state.totalChats}</code>
Estimated time: <code>${formatDuration(estimatedRemaining)}</code>
Success: <code>${state.successCount}</code>
Blocked: <code>${state.blockedCount}</code>
Deleted: <code>${state.deletedCount}</code>`,
    { parse_mode: "HTML" },
  );
});

composer.command("broadcast_cancel", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const state = await getBroadcastState();
  if (!state) {
    return ctx.reply(`<blockquote>No broadcast in progress</blockquote>`, {
      parse_mode: "HTML",
    });
  }

  await clearBroadcastState();
  await ctx.reply(
    `<blockquote>Broadcast cancelled!</blockquote>

Completed: <code>${state.currentIndex}/${state.totalChats}</code>`,
    { parse_mode: "HTML" },
  );
});

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const broadcastCommand = composer;
export { performBroadcast, getBroadcastState };
