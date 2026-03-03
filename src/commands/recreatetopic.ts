import { Composer } from "grammy";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";
import { adminOnlyGuards, runGuards } from "../util/guards";

const composer = new Composer();

composer.command("recreatetopic", async (ctx) => {
  if (!ctx.message) return;

  if (!ctx.chat.is_forum) {
    await ctx.reply("This command can only be used in forum groups.");
    return;
  }

  const guard = await runGuards(ctx, adminOnlyGuards);
  if (!guard.ok) return ctx.reply(guard.message);

  const topicId = ctx.msg.message_thread_id?.toString();
  if (!topicId) {
    return ctx.reply(
      "General topics can't expire. So, you don't need to use this",
    );
  }

  const args = ctx.message.text.split(" ").slice(1);
  const action = args[0]?.toLowerCase();

  if (!action || !["on", "off"].includes(action)) {
    return ctx.reply(
      "Please specify 'on' or 'off'.\nUsage: /recreatetopic on or /recreatetopic off",
    );
  }

  const shouldRecreate = action === "on";

  try {
    const result = await db
      .updateTable("chatGameTopics")
      .set({ shouldRecreateOnExpire: shouldRecreate })
      .where("chatId", "=", ctx.chat.id.toString())
      .where("topicId", "=", topicId)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      return ctx.reply(
        "No game topic set for this topic.\nUse /setgametopic first.",
      );
    }

    await ctx.reply(
      `Topic recreation on expire has been turned ${action.toUpperCase()}.`,
    );
  } catch (err) {
    console.error("Error updating recreate topic setting:", err);
    await ctx.reply("An error occurred while updating the setting.");
  }
});

CommandsHelper.addNewCommand(
  "recreatetopic",
  "Toggle topic recreation on expire (on/off)",
);

export const recreateTopicCommand = composer;
