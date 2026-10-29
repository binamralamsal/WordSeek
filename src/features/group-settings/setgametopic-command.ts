import { Composer } from "grammy";

import pg from "pg";

import { db } from "#/config/db";
import { adminOnlyGuards, runGuards } from "#/core/guards";

import { getCurrentTopicId, isForumGroup } from "./topic";

const { DatabaseError } = pg;

const composer = new Composer();

composer.command("setgametopic", async (ctx) => {
  if (!ctx.message) return;

  if (!isForumGroup(ctx)) {
    await ctx.reply("This command can only be used in forum groups.");
    return;
  }

  const guard = await runGuards(ctx, adminOnlyGuards);
  if (!guard.ok) return ctx.reply(guard.message);

  const topicId = getCurrentTopicId(ctx);

  try {
    await db
      .insertInto("chatGameTopics")
      .values({ chatId: ctx.chat.id.toString(), topicId })
      .execute();

    await ctx.reply(
      `@${ctx.me.username} will now use this topic for the game.`,
    );
  } catch (err) {
    if (err instanceof DatabaseError && err.code === "23505") {
      return await ctx.reply(
        "Game has already been set for this topic.\nUse /unsetgametopic to unset it first.",
      );
    }
  }
});

export const setGameTopicCommand = composer;
