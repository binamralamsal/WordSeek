import { Composer } from "grammy";

import { db } from "../config/db";
import { env } from "../config/env";

const composer = new Composer();

composer.command("transfer", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const args = ctx.match.trim().split(/\s+/);

  if (args.length !== 2) {
    return ctx.reply(
      "Usage: /transfer <from_user> <to_user>\n" +
        "Example: /transfer @username1 @username2\n" +
        "Or: /transfer user_id_1 user_id_2",
    );
  }

  const [fromIdentifier, toIdentifier] = args;

  const getUser = async (identifier: string) => {
    const isUsername = identifier.startsWith("@");
    return await db
      .selectFrom("users")
      .selectAll()
      .where(
        isUsername ? "username" : "id",
        "=",
        isUsername ? identifier.substring(1) : identifier,
      )
      .executeTakeFirst();
  };

  const fromUser = await getUser(fromIdentifier);
  const toUser = await getUser(toIdentifier);

  if (!fromUser) {
    return ctx.reply(`❌ Source user not found: ${fromIdentifier}`);
  }

  if (!toUser) {
    return ctx.reply(`❌ Destination user not found: ${toIdentifier}`);
  }

  if (fromUser.id === toUser.id) {
    return ctx.reply("❌ Cannot transfer to the same user");
  }

  try {
    const leaderboardEntries = await db
      .selectFrom("leaderboard")
      .selectAll()
      .where("userId", "=", fromUser.id)
      .execute();

    if (leaderboardEntries.length === 0) {
      return ctx.reply(
        `ℹ️ ${fromUser.name} has no leaderboard entries to transfer`,
      );
    }

    await db
      .updateTable("leaderboard")
      .set({ userId: toUser.id })
      .where("userId", "=", fromUser.id)
      .execute();

    const totalScore = leaderboardEntries.reduce(
      (sum, entry) => sum + entry.score,
      0,
    );

    await ctx.reply(
      `✅ Successfully transferred leaderboard data:\n\n` +
        `From: ${fromUser.name} (${fromUser.id})\n` +
        `To: ${toUser.name} (${toUser.id})\n\n` +
        `Entries transferred: ${leaderboardEntries.length}\n` +
        `Total score transferred: ${totalScore}`,
    );
  } catch (error) {
    console.error("Error transferring leaderboard:", error);
    await ctx.reply("❌ An error occurred while transferring leaderboard data");
  }
});

export const transferCommand = composer;
