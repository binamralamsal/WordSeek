import { Composer, GrammyError } from "grammy";

import { env } from "#/config/env";

import {
  getMainHelpKeyboard,
  type HelpSection,
} from "./helpers/keyboard.helper";
import {
  getAdminCommandsMessage,
  getGroupSettingsMessage,
  getHowToPlayMessage,
  getOtherCommandsMessage,
  getScoresMessage,
} from "./helpers/messages.helper";

const composer = new Composer();

const HELP_SECTIONS: Record<
  string,
  { message: () => string; active: HelpSection }
> = {
  help_main: { message: getHowToPlayMessage, active: "howto" },
  help_howto: { message: getHowToPlayMessage, active: "howto" },
  help_scores: { message: getScoresMessage, active: "scores" },
  help_group: { message: getGroupSettingsMessage, active: "group" },
  help_other: { message: getOtherCommandsMessage, active: "other" },
  help_admin: { message: getAdminCommandsMessage, active: "admin" },
};

composer.callbackQuery(/^help_/, async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }

  const section = HELP_SECTIONS[ctx.callbackQuery.data];
  if (!section) {
    await ctx.answerCallbackQuery();
    return;
  }

  const shouldShowAdminCommands =
    env.ADMIN_USERS.includes(ctx.from.id) && ctx.chat?.type === "private";

  if (section.active === "admin" && !shouldShowAdminCommands) {
    await ctx.answerCallbackQuery({
      text: "You don't have permission to view this.",
      show_alert: true,
    });
    return;
  }

  const message = section.message();
  const keyboard = getMainHelpKeyboard(shouldShowAdminCommands, section.active);

  try {
    await ctx.editMessageText({ html: message }, { reply_markup: keyboard });
  } catch (err) {
    if (
      err instanceof GrammyError &&
      !err.description.includes("message is not modified")
    ) {
      await ctx.deleteMessage();
      await ctx.replyWithRichMessage(
        { html: message },
        { reply_markup: keyboard },
      );
    }
  }

  await ctx.answerCallbackQuery();
});

export const helpCallbacks = composer;
