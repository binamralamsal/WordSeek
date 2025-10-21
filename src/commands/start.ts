import { Composer } from "grammy";

import { FOOTER_MESSAGE } from "../config/constants";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("start", async (ctx) => {
  ctx.reply(
    `<blockquote><strong>WordSeek</strong></blockquote>
A fun and competitive Wordle-style game that you can play directly on Telegram!

1. Use /new to start a game. Add me to a group with admin permission to play with your friends.
2. Use /help to get help on how to play and commands list.\n
${FOOTER_MESSAGE}`,
    { parse_mode: "HTML" },
  );
});

CommandsHelper.addNewCommand("start", "Start the bot.");

export const startCommand = composer;
