import { Composer } from "grammy";

import { db } from "#/config/db";
import { adminOnlyGuards, runGuards } from "#/core/guards";

import { getCurrentTopicId, isForumGroup } from "./topic";

const composer = new Composer();

composer.command("unsetgametopic", async (ctx) => {
  if (!ctx.message) return;

  if (!isForumGroup(ctx)) {
    await ctx.reply("This command can only be used in forum groups.");
    return;
  }

  const guard = await runGuards(ctx, adminOnlyGuards);
  if (!guard.ok) return ctx.reply(guard.message);

  const topicId = getCurrentTopicId(ctx);

  await db
    .deleteFrom("chatGameTopics")
    .where("chatId", "=", ctx.chat.id.toString())
    .where("topicId", "=", topicId)
    .execute();

  await ctx.reply(`@${ctx.me.username} won't use this topic for the game.`);
});

export const unsetGameTopicCommand = composer;
