import { db } from "#/config/db";
import { bot } from "#/config/bot";
import { formatDuration } from "#/core/format/duration";

import {
  type BroadcastState,
  clearBroadcastState,
  getBroadcastState,
  saveBroadcastState,
} from "./state";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function performBroadcast(
  chats: { id: string }[],
  state: BroadcastState,
) {
  for (let i = state.currentIndex; i < chats.length; i++) {
    const chat = chats[i]!;

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

export async function resumeBroadcast() {
  const state = await getBroadcastState();
  if (!state) return;

  console.log(
    `Resuming broadcast from index ${state.currentIndex}/${state.totalChats}`,
  );

  const chats = await db
    .selectFrom("broadcastChats")
    .selectAll()
    .orderBy("broadcastChats.createdAt", "asc")
    .execute();

  try {
    await bot.api.editMessageText(
      state.statusChatId,
      state.statusMessageId,
      `<blockquote>Broadcast resumed after restart!</blockquote>

Resuming from: <code>${state.currentIndex}/${state.totalChats}</code>
Total Users: <code>${state.totalChats}</code>
Success so far: <code>${state.successCount}</code>`,
      { parse_mode: "HTML" },
    );
  } catch (error) {
    console.error("Failed to update status message:", error);
  }

  await performBroadcast(chats, state);
  console.log("Broadcast resumed and completed successfully");
}
