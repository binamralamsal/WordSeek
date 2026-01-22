import { getBroadcastState, performBroadcast } from "../commands/broadcast";
import { bot } from "../config/bot";
import { db } from "../config/db";

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
