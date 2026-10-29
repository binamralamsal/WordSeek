import { Composer } from "grammy";

import { db } from "#/config/db";
import { WORD_LENGTHS, type WordLength } from "#/types";
import { createLogger } from "#/core/logging/logger.service";
import { adminOnlyGuards, runGuards } from "#/core/guards/admin.guard";

import { getCurrentTopicId, isForumGroup } from "./topic.service";

const log = createLogger("features.group-settings.allowonlylen.command");

const composer = new Composer();

composer.command("allowonlylen", async (ctx) => {
  if (!ctx.message) return;

  if (!isForumGroup(ctx)) {
    return ctx.reply("This command can only be used in forum groups.");
  }

  const guard = await runGuards(ctx, adminOnlyGuards);
  if (!guard.ok) return ctx.reply(guard.message);

  const topicId = getCurrentTopicId(ctx);

  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) {
    return ctx.reply("Usage: /allowonlylen 5 4 6");
  }

  const lengths = args
    .map((x) => Number(x) as WordLength)
    .filter((x) => (WORD_LENGTHS as readonly number[]).includes(x));

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
    log.error(err);
    return ctx.reply("Failed to update allowed lengths.");
  }
});

export const allowOnlyLenCommand = composer;
