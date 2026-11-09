import { Composer, InlineKeyboard } from "grammy";

import { env } from "#/config/env";
import { replyNotice } from "#/core/telegram/reply-notice.helper";

const composer = new Composer();

composer.command("app", async (ctx) => {
  if (!env.MINIAPP_URL) {
    return replyNotice(
      ctx,
      "The WordSeek Mini App is not available right now. Use /daily or /new to play here.",
    );
  }

  if (ctx.chat.type === "private") {
    const keyboard = new InlineKeyboard().webApp(
      "🎮 Play WordSeek",
      env.MINIAPP_URL,
    );

    return ctx.reply(
      "<b>Play WordSeek</b>\nDaily puzzles, classic games, leaderboards and your profile — all in one place.",
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  }

  const chatId = ctx.chat.id.toString();
  const link = `https://t.me/${ctx.me.username}/${env.MINIAPP_SHORT_NAME}?startapp=g${chatId}`;
  const keyboard = new InlineKeyboard().url("🎮 Open WordSeek", link);

  return ctx.reply(
    "<b>Play WordSeek</b>\nOpen the Mini App to play and see this group's ranking.",
    { parse_mode: "HTML", reply_markup: keyboard },
  );
});

export const appCommand = composer;
