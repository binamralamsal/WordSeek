import { Composer } from "grammy";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("unsetgametopic", async (ctx) => {
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
