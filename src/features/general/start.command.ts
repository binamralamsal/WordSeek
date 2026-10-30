import { Composer, InlineKeyboard, InputFile } from "grammy";

import { createReadStream } from "node:fs";

import {
  DISCUSSION_GROUP,
  DONATION_LINK,
  UPDATES_CHANNEL,
} from "#/config/constants";

const BANNER_PATH = "./src/data/banner.png";

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
    .url("Discussion", DISCUSSION_GROUP)
    .row()
    .url("💓 Donate", DONATION_LINK)
    .success();

  const richContent = `<img src="tg://photo?id=banner" alt="WordSeek banner"/>
<h2>Welcome to WordSeek!</h2>
<p>A fun and competitive Wordle-style game you can play right here on Telegram.</p>
<blockquote>
<b>Quick start</b>
<ul>
<li>Use /new to start a new game</li>
<li>Add me to a group with admin permissions to play with friends</li>
<li>Use /help for detailed instructions and the full command list</li>
</ul>
</blockquote>
<p><b>Ready to test your word skills? Let's play!</b></p>`;

  try {
    await ctx.replyWithRichMessage(
      {
        html: richContent,
        media: [
          {
            id: "banner",
            media: {
              type: "photo",
              media: new InputFile(createReadStream(BANNER_PATH)),
            },
          },
        ],
      },
      { reply_markup: keyboard },
    );
  } catch {
    // Rich media uploads are still rolling out. Fall back to a normal photo
    // message so /start always works.
    const caption = `<b>Welcome to WordSeek!</b>

A fun and competitive Wordle-style game that you can play directly on Telegram.

<blockquote><b>Quick Start:</b>
• Use /new to start a new game
• Add me to a group with admin permissions to play with friends
• Use /help for detailed instructions and command list</blockquote>

Ready to test your word skills? Let's play!`;

    try {
      await ctx.replyWithPhoto(new InputFile(createReadStream(BANNER_PATH)), {
        caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch {
      await ctx.replyWithRichMessage(
        { html: richContent.replace(/<img[^>]*\/>\n?/, "") },
        { reply_markup: keyboard },
      );
    }
  }
});

export const startCommand = composer;
