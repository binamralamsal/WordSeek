import { GrammyError } from "grammy";
import type { Context } from "grammy";

import type { ReactionTypeEmoji } from "grammy/types";

export async function reactWithRandom(ctx: Context) {
  const emojis: ReactionTypeEmoji["emoji"][] = [
    "🎉",
    "🏆",
    "🤩",
    "⚡",
    "🫡",
    "💯",
    "❤‍🔥",
    "🦄",
  ];

  const shuffled = emojis.sort(() => Math.random() - 0.5);

  for (const emoji of shuffled) {
    try {
      await ctx.react(emoji);
      return;
    } catch (err) {
      if (
        err instanceof GrammyError &&
        err.description?.includes("REACTION_NOT_ALLOWED")
      ) {
        continue;
      }
      break;
    }
  }
}
