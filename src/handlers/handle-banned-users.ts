import { Composer, InlineKeyboard } from "grammy";

import { db } from "../config/db";

const composer = new Composer();

composer.on("message", async (ctx, next) => {
  const isUserBanned = await db
    .selectFrom("bannedUsers")
    .selectAll()
    .where("userId", "=", ctx.from.id.toString())
    .executeTakeFirst();

  if (!isUserBanned) return await next();

  if (ctx.chat.type === "private") {
    const keyboard = new InlineKeyboard();
    keyboard.url("Appeal", "t.me/binamralamsal").primary();

    return ctx.reply(
      "⚠️ You have been banned from bot for cheating using automated scripts!",
      {
        reply_markup: keyboard,
      },
    );
  }
});

export const handleBannedUsers = composer;
