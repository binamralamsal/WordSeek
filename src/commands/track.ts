import { Composer } from "grammy";
import { redis } from "../config/redis";
import { env } from "../config/env";

const composer = new Composer();

composer.command("track", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const chatId = ctx.match.trim();
  if (!chatId) {
    return ctx.reply("Usage: /track <chat_id>");
  }

  const trackingKey = `tracking:${chatId}`;
  const existingTracking = await redis.get(trackingKey);

  if (existingTracking) {
    return ctx.reply(`⚠️ Chat ${chatId} is already being tracked`);
  }

  await redis.set(trackingKey, ctx.chat.id.toString());

  await ctx.reply(`✅ Now tracking chat: ${chatId}\nAll messages will be forwarded here.`);
});

composer.command("untrack", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const chatId = ctx.match.trim();
  if (!chatId) {
    return ctx.reply("Usage: /untrack <chat_id>");
  }

  const trackingKey = `tracking:${chatId}`;
  const deleted = await redis.del(trackingKey);

  if (deleted === 0) {
    return ctx.reply(`⚠️ Chat ${chatId} is not being tracked`);
  }

  await ctx.reply(`✅ Stopped tracking chat: ${chatId}`);
});

composer.command("tracklist", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const keys = await redis.keys("tracking:*");

  if (keys.length === 0) {
    return ctx.reply("No chats are currently being tracked");
  }

  const trackedChats = keys.map(key => key.replace("tracking:", "")).join("\n");
  await ctx.reply(`📋 Currently tracking:\n${trackedChats}`);
});

export const trackCommand = composer;
