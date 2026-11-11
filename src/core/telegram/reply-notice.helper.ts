import type { Context } from "grammy";

import { escapeHtml } from "#/core/format/escape-html.helper";

/** Sends a short plain-text notice as a rich blockquote. */
export function replyNotice(ctx: Context, message: string) {
  return ctx.replyWithRichMessage({
    html: `<blockquote>${escapeHtml(message)}</blockquote>`,
  });
}
