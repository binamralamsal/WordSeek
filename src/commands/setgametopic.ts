import { Composer } from "grammy";

import pg from "pg";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";

const { DatabaseError } = pg;

const composer = new Composer();

composer.command("setgametopic", async (ctx) => {
  if (!ctx.message) return;

  if (!ctx.chat.is_forum) {
    await ctx.reply("This command can only be used in forum groups.");
    return;
  }

  try {
    const chatMember = await ctx.api.getChatMember(
      ctx.chat.id,
      ctx.message.from.id,
    );

    const allowedStatus = ["administrator", "creator"];
    if (!allowedStatus.includes(chatMember.status)) {
      return ctx.reply("Only admins can use this command.");
    }
  } catch {
    return ctx.reply(
      "⚠️ I couldn't verify admin rights.\n" +
        "👉 Please make sure I’m an admin in this group.",
    );
  }

  let topicId = ctx.msg.message_thread_id?.toString();

  if (!topicId) {
    topicId = "general";
  }

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

CommandsHelper.addNewCommand("setgametopic", "Set current topic for the game");

export const setGameTopicCommand = composer;
