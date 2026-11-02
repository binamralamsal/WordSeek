import type { Context } from "grammy";

import type { InlineKeyboardMarkup } from "grammy/types";

import { wordleImageFile } from "./image.helper";

type BoardFallback = {
  caption: string;
  replyMarkup?: InlineKeyboardMarkup;
};

/**
 * Sends a generated board as a rich message with an inline media block.
 * Falls back to a normal photo message when rich media is unavailable.
 */
export async function sendBoardMessage(
  ctx: Context,
  imageBuffer: Buffer,
  html: string,
  fallback: BoardFallback,
) {
  try {
    await ctx.replyWithRichMessage({
      html: `<img src="tg://photo?id=board" alt="WordSeek board"/>\n${html}`,
      media: [
        {
          id: "board",
          media: {
            type: "photo",
            media: wordleImageFile(imageBuffer),
          },
        },
      ],
    });
  } catch {
    await ctx.replyWithPhoto(wordleImageFile(imageBuffer), {
      caption: fallback.caption,
      parse_mode: "HTML",
      reply_markup: fallback.replyMarkup,
    });
  }
}
