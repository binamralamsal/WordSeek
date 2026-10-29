import type { Context } from "grammy";

type EditMessageOptions = Parameters<Context["editMessageText"]>[1];

export async function editMessageTextSafe(
  ctx: Context,
  text: string,
  options?: EditMessageOptions,
) {
  try {
    await ctx.editMessageText(text, options);
  } catch {
    // Ignore edits that fail because the message is unchanged or unavailable.
  }
}
