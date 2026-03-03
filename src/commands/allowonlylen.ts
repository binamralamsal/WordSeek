import { Composer } from "grammy";

import { db } from "../config/db";
import { CommandsHelper } from "../util/commands-helper";
import { adminOnlyGuards, runGuards } from "../util/guards";

const composer = new Composer();

const VALID = [4, 5, 6];

composer.command("allowonlylen", async (ctx) => {
  if (!ctx.message) return;

  if (!ctx.chat?.is_forum) {
    return ctx.reply("This command can only be used in forum groups.");
  }

  const guard = await runGuards(ctx, adminOnlyGuards);
  if (!guard.ok) return ctx.reply(guard.message);

  const topicId = ctx.msg.message_thread_id?.toString() || "general";

  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) {
    return ctx.reply("Usage: /allowonlylen 5 4 6");
  }

  const lengths = args.map((x) => Number(x)).filter((x) => VALID.includes(x));

  if (!lengths.length) {
    return ctx.reply("Allowed lengths are only: 4, 5, 6");
  }

  try {
    const existing = await db
      .selectFrom("chatGameTopics")
      .selectAll()
      .where("chatId", "=", ctx.chat.id.toString())
      .where("topicId", "=", topicId)
      .executeTakeFirst();

    if (!existing) {
      return ctx.reply(
        "This topic is not set for the game.\nUse /setgametopic first.",
      );
    }

    await db
      .updateTable("chatGameTopics")
      .set({ allowedLengths: lengths })
      .where("chatId", "=", ctx.chat.id.toString())
      .where("topicId", "=", topicId)
      .execute();

    return ctx.reply(
      `Allowed word lengths updated.\nDefault length: ${lengths[0]}\nAllowed: ${lengths.join(", ")}`,
    );
  } catch (err) {
    console.error(err);
    return ctx.reply("Failed to update allowed lengths.");
  }
});

CommandsHelper.addNewCommand(
  "allowonlylen",
  "Set allowed word lengths for this topic (e.g. /allowonlylen 5 4)",
);

export const allowOnlyLenCommand = composer;
