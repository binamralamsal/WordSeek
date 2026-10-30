import { Composer } from "grammy";

import { db } from "#/config/db";
import { env } from "#/config/env";
import { formatDuration } from "#/core/format/duration.helper";

import {
  acquireBroadcastLock,
  type BroadcastState,
  clearBroadcastState,
  getBroadcastState,
  saveBroadcastState,
} from "./broadcast-state.service";
import { performBroadcast } from "./broadcast.service";

const composer = new Composer();

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

  const chats = await db
    .selectFrom("broadcastChats")
    .selectAll()
    .orderBy("broadcastChats.createdAt", "asc")
    .execute();

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

export const broadcastCommand = composer;
