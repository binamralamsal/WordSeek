import { Composer } from "grammy";

import { db } from "#/config/db";
import { env } from "#/config/env";
import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys";
import { formatUserMention } from "#/core/format/mention";

import { captchaQueue } from "./queue";
import { captchaSchema } from "./schema";
import { buildCaptchaKeyboard, buildMessage, decodeSlot } from "./ui";

const composer = new Composer();

composer.command("captcha", async (ctx) => {
  if (!ctx.from || !env.ADMIN_USERS.includes(ctx.from.id)) {
    return;
  }

  if (ctx.chat?.type !== "private") {
    return;
  }

  if (!ctx.message) return;

  const parts = ctx.message.text.split(" ");
  const chatId = parts[1];
  const userId = parts[2];

  if (!chatId || !userId) {
    return ctx.reply("Usage: /captcha <chatId> <userId>");
  }

  const key = redisKeys.captcha(chatId, userId);
  const existing = await redis.get(key);

  if (existing) {
    const session = JSON.parse(existing);

    return ctx.reply(
      `⚠️ A captcha is already active for this user.\n\n` +
        `Attempts: ${session.attempts}/3\n` +
        `Status: Not yet completed`,
    );
  }

  const user = await db
    .selectFrom("users")
    .select(["id", "name", "username"])
    .where("id", "=", userId)
    .executeTakeFirst();

  const mention = formatUserMention({
    id: userId,
    name: user?.name,
    username: user?.username,
  });

  const diceMsg = await ctx.api.sendDice(chatId, "🎰");
  const value = diceMsg.dice!.value;

  const answer = decodeSlot(value);

  const keyboard = buildCaptchaKeyboard([]);

  const msg = await ctx.api.sendMessage(
    chatId,
    buildMessage({
      mention,
      progress: [],
      attempts: 0,
      maxAttempts: 3,
    }),
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
      reply_parameters: { message_id: diceMsg.message_id },
    },
  );

  const session = captchaSchema.parse({
    chatId,
    userId,
    adminId: ctx.from.id.toString(),
    messageId: msg.message_id,
    answer,
    progress: [],
    attempts: 0,
    createdAt: Date.now(),
    name: user?.name,
    username: user?.username,
  });

  await redis.set(key, JSON.stringify(session), "EX", 80); // 80 second to make sure bullmq fires

  await captchaQueue.add(
    "expire",
    { chatId, userId, messageId: msg.message_id },
    { delay: 60_000, removeOnComplete: true },
  );

  const mentionText = user
    ? formatUserMention({
        id: userId,
        name: user.name,
        username: user.username,
      })
    : `<a href="tg://user?id=${userId}">User</a>`;

  await ctx.reply(`✅ Captcha sent for ${mentionText}.`, {
    parse_mode: "HTML",
  });
});

export const captchaCommand = composer;
