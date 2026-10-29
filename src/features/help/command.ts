import { Composer } from "grammy";

import { env } from "#/config/env";

import { getMainHelpKeyboard } from "./keyboard";
import { getHowToPlayMessage } from "./messages";

const composer = new Composer();

composer.command("help", async (ctx) => {
  if (!ctx.from) return;

  const shouldShowAdmin =
    env.ADMIN_USERS.includes(ctx.from.id) && ctx.chat.type === "private";
  const keyboard = getMainHelpKeyboard(shouldShowAdmin, "howto");

  await ctx.replyWithRichMessage(
    { html: getHowToPlayMessage() },
    { reply_markup: keyboard },
  );
});

export const helpCommand = composer;
