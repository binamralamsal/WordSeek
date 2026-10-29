import { Composer } from "grammy";

import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys";
import { formatUserMention } from "#/core/format/mention";
import { editMessageTextSafe } from "#/core/telegram/edit-message";

import { captchaSchema } from "./schema";
import { buildCaptchaKeyboard, buildMessage } from "./ui";

const composer = new Composer();

composer.callbackQuery(/^captcha_/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat?.id.toString();
  const name = ctx.from.first_name;
  const username = ctx.from.username;

  if (!chatId) return ctx.answerCallbackQuery();

  const key = redisKeys.captcha(chatId, userId);
  const raw = await redis.get(key);

  if (!raw) {
    return ctx.answerCallbackQuery({
      text: "Captcha expired or, this captcha isn't for you.",
      show_alert: true,
    });
  }

  const session = captchaSchema.parse(JSON.parse(raw));

  const mentionText = formatUserMention({
    id: userId,
    name,
    username,
  });

  if (data === "captcha_clear") {
    session.progress = [];
  } else if (data === "captcha_back") {
    session.progress.pop();
  }

  if (data.startsWith("captcha_pick")) {
    const emoji = data.split(" ")[1];

    if (session.progress.length < 3 && emoji) {
      session.progress.push(emoji);
    }
  }

  const keyboard = buildCaptchaKeyboard(session.progress);

  if (session.progress.length === 3) {
    const success =
      JSON.stringify(session.progress) === JSON.stringify(session.answer);

    if (success) {
      await redis.del(key);

      await ctx.api.sendMessage(
        session.adminId,
        `✅ ${mentionText} passed the captcha.`,
        { parse_mode: "HTML" },
      );

      await editMessageTextSafe(
        ctx,
        buildMessage({
          mention: mentionText,
          progress: session.progress,
          attempts: session.attempts,
          maxAttempts: 3,
          status: "Verification successful ✅",
        }),
        { parse_mode: "HTML" },
      );

      return ctx.answerCallbackQuery();
    }

    session.attempts += 1;

    if (session.attempts >= 3) {
      await redis.del(key);

      await ctx.api.sendMessage(
        session.adminId,
        `❌ ${mentionText} failed the captcha.\nExpected: ${session.answer.join(
          " ",
        )}\nGot: ${session.progress.join(" ")}`,
        { parse_mode: "HTML" },
      );

      await editMessageTextSafe(
        ctx,
        buildMessage({
          mention: mentionText,
          progress: session.answer,
          attempts: session.attempts,
          maxAttempts: 3,
          status: "Verification failed ❌",
        }),
        { parse_mode: "HTML" },
      );

      return ctx.answerCallbackQuery();
    }

    session.progress = [];

    await redis.set(key, JSON.stringify(session), "KEEPTTL");

    await editMessageTextSafe(
      ctx,
      buildMessage({
        mention: mentionText,
        progress: [],
        attempts: session.attempts,
        maxAttempts: 3,
        status: "Incorrect selection. Try again.",
      }),
      {
        reply_markup: keyboard,
        parse_mode: "HTML",
      },
    );

    return ctx.answerCallbackQuery();
  }

  await redis.set(key, JSON.stringify(session), "KEEPTTL");

  await editMessageTextSafe(
    ctx,
    buildMessage({
      mention: mentionText,
      progress: session.progress,
      attempts: session.attempts,
      maxAttempts: 3,
    }),
    {
      reply_markup: keyboard,
      parse_mode: "HTML",
    },
  );

  return ctx.answerCallbackQuery();
});

export const captchaCallbacks = composer;
