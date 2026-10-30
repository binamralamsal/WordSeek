import type { Context } from "grammy";

import type { InputRichMessage } from "grammy/types";

type EditMessageOptions = Parameters<Context["editMessageText"]>[1];

export async function editMessageTextSafe(
  ctx: Context,
  text: string | InputRichMessage,
  options?: EditMessageOptions,
) {
  try {
    await ctx.editMessageText(text, options);
  } catch {
    // Ignore edits that fail because the message is unchanged or unavailable.
  }
}
