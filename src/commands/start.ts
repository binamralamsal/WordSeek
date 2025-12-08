import { Composer, InlineKeyboard, InputFile } from "grammy";

import { createReadStream } from "fs";

import { DISCUSSION_GROUP, UPDATES_CHANNEL } from "../config/constants";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .url(
      "Add me to your Group",
      `https://t.me/${ctx.me.username}?startgroup=true`,
    )
    .row()
    .url("Updates", UPDATES_CHANNEL)
    .text("Help", "help_howto")
    .url("Discussion", DISCUSSION_GROUP);

  const caption = `<b>Welcome to WordSeek!</b>

A fun and competitive Wordle-style game that you can play directly on Telegram.

<blockquote><b>Quick Start:</b>
• Use /new to start a new game
• Add me to a group with admin permissions to play with friends
• Use /help for detailed instructions and command list</blockquote>

Ready to test your word skills? Let's play!`;

  await ctx.replyWithPhoto(
    new InputFile(createReadStream("./src/data/banner.png")),
    {
      caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
  );
});

CommandsHelper.addNewCommand("start", "Start the bot");

export const startCommand = composer;
