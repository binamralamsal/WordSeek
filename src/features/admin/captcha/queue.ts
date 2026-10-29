import { Queue, Worker } from "bullmq";

import { bot } from "#/config/bot";
import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys";
import { formatUserMention } from "#/core/format/mention";

import { captchaSchema } from "./schema";

export const captchaQueue = new Queue("captcha-expiry", {
  connection: redis,
});

new Worker(
  "captcha-expiry",
  async (job) => {
    const { chatId, userId, messageId } = job.data;

    const key = redisKeys.captcha(chatId, userId);
    const raw = await redis.get(key);

    if (!raw) return;

    const session = captchaSchema.parse(JSON.parse(raw));

    await redis.del(key);

    const mention = formatUserMention({
      id: session.userId,
      name: session.name,
      username: session.username,
    });

    try {
      await bot.api.editMessageText(
        chatId,
        messageId,
        `⏰ <b>Verification timed out</b>\n\n${mention} didn’t complete it in time.`,
        { parse_mode: "HTML" },
      );
    } catch (e) {
      console.error("Edit failed:", e);
    }

    try {
      await bot.api.sendMessage(
        session.adminId,
        `⏰ ${mention} did not complete the captcha in time.`,
        { parse_mode: "HTML" },
      );
    } catch (e) {
      console.error("Admin notify failed:", e);
    }
  },
  {
    connection: redis,
  },
);
