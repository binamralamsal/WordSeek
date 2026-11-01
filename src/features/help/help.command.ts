import { Composer } from "grammy";

import { env } from "#/config/env";
import { renderInlineKeyboard } from "#/core/telegram/rich-keyboard.helper";
import { formatCommunityFooter } from "#/core/ui/format-community-footer.helper";

import { getMainHelpKeyboard } from "./helpers/keyboard.helper";
import { getHowToPlayMessage } from "./helpers/messages.helper";

const composer = new Composer();

composer.command("help", async (ctx) => {
  if (!ctx.from) return;

  const shouldShowAdmin =
    env.ADMIN_USERS.includes(ctx.from.id) && ctx.chat.type === "private";
  const keyboard = getMainHelpKeyboard(shouldShowAdmin, "howto");

  await ctx.replyWithRichMessage({
    html: `${getHowToPlayMessage()}
${formatCommunityFooter()}
${renderInlineKeyboard(keyboard)}`,
  });
});

export const helpCommand = composer;
