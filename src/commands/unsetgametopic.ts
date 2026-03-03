import { Composer } from "grammy";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";
import { adminOnlyGuards, runGuards } from "../util/guards";

const composer = new Composer();

composer.command("unsetgametopic", async (ctx) => {
  if (!ctx.message) return;

  if (!ctx.chat.is_forum) {
    await ctx.reply("This command can only be used in forum groups.");
    return;
  }

  const guard = await runGuards(ctx, adminOnlyGuards);
  if (!guard.ok) return ctx.reply(guard.message);

  const topicId = ctx.msg.message_thread_id?.toString() || "general";

  await db
    .deleteFrom("chatGameTopics")
    .where("chatId", "=", ctx.chat.id.toString())
    .where("topicId", "=", topicId)
    .execute();

  await ctx.reply(`@${ctx.me.username} won't use this topic for the game.`);
});

CommandsHelper.addNewCommand(
  "unsetgametopic",
  "Unset current topic for the game",
);

export const unsetGameTopicCommand = composer;
