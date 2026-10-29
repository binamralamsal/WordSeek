import type { Context } from "grammy";

import { db } from "#/config/db";
import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys";
import type { Guard, GuardResult } from "#/core/guards";

import { dailyWordleSchema } from "./daily-session";

export async function requirePrivateChat(ctx: Context): Promise<GuardResult> {
  if (!ctx.chat || ctx.chat.type !== "private") {
    return {
      ok: false,
      message:
        "WordSeek of the Day can only be played in private chat with the bot. Send me a message directly!",
    };
  }
  return { ok: true };
}

export async function requireNoActiveDailyGame(
  ctx: Context,
): Promise<GuardResult> {
  if (!ctx.from) return { ok: true };
  const userId = ctx.from.id.toString();

  const dailyGameData = await redis.get(redisKeys.dailySession(userId));
  const result = dailyWordleSchema.safeParse(JSON.parse(dailyGameData || "{}"));

  if (result.data) {
    return {
      ok: false,
      message:
        "⚠️ You have an active WordSeek of the Day game in your private chat. Please pause it with /pausedaily before playing regular WordSeek.",
    };
  }
  return { ok: true };
}

async function requireNoActiveRegularGame(ctx: Context): Promise<GuardResult> {
  if (!ctx.from) return { ok: true };

  const userId = ctx.from.id.toString();
  const activeGame = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", userId)
    .executeTakeFirst();

  if (activeGame) {
    return {
      ok: false,
      message:
        "⚠️ You have an active regular WordSeek game. Please complete or end that game with /end before starting WordSeek of the Day.",
    };
  }
  return { ok: true };
}

export async function requireAllowedTopic(ctx: Context): Promise<GuardResult> {
  if (!ctx.chat || !ctx.msg || !ctx.chat.is_forum) return { ok: true };

  const chatId = ctx.chat.id;
  const topicData = await db
    .selectFrom("chatGameTopics")
    .where("chatId", "=", chatId.toString())
    .selectAll()
    .execute();

  const topicIds = topicData.map((t) => t.topicId);
  const currentTopicId = ctx.msg.message_thread_id?.toString() || "general";

  if (topicData.length > 0 && !topicIds.includes(currentTopicId)) {
    return {
      ok: false,
      message:
        "This topic is not set for the game. Please play the game in the designated topic.",
    };
  }
  return { ok: true };
}

export const dailyGameGuards: Guard[] = [
  requirePrivateChat,
  requireNoActiveRegularGame,
];

export const regularGameGuards: Guard[] = [
  requireAllowedTopic,
  requireNoActiveDailyGame,
];
