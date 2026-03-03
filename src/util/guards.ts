import { Context } from "grammy";

import { db } from "../config/db";
import { redis } from "../config/redis";
import { dailyWordleSchema } from "../handlers/on-message";

type GuardResult = { ok: true } | { ok: false; message: string };

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

  const dailyGameData = await redis.get(`daily_wordle:${userId}`);
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

export async function requireAdmin(ctx: Context): Promise<GuardResult> {
  if (!ctx.chat || !ctx.from) return { ok: true };

  if (ctx.chat.type === "private") return { ok: true };

  try {
    const chatMember = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);

    const allowedStatus = ["administrator", "creator"];

    if (!allowedStatus.includes(chatMember.status)) {
      return {
        ok: false,
        message: "Only admins can use this command.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "⚠️ I couldn't verify admin rights.\n" +
        "👉 Please make sure I’m an admin in this group.",
    };
  }
}

type Guard = (ctx: Context) => Promise<GuardResult>;

export async function runGuards(
  ctx: Context,
  guards: Guard[],
): Promise<GuardResult> {
  for (const guard of guards) {
    const result = await guard(ctx);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export const dailyGameGuards = [requirePrivateChat, requireNoActiveRegularGame];

export const regularGameGuards = [
  requireAllowedTopic,
  requireNoActiveDailyGame,
];

export const adminOnlyGuards = [requireAdmin];
