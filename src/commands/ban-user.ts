import { Composer } from "grammy";

import { eq } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../drizzle/db";
import { bannedUsersTable, usersTable } from "../drizzle/schema";

const composer = new Composer();

composer.command("ban", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const isUsername = ctx.match.startsWith("@");
  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      isUsername
        ? eq(usersTable.username, ctx.match.substring(1))
        : eq(usersTable.telegramUserId, ctx.match),
    );

  if (!user) return ctx.reply("Can't find the user");

  const [existingBan] = await db
    .select()
    .from(bannedUsersTable)
    .where(eq(bannedUsersTable.userId, user.id));

  if (existingBan) {
    return ctx.reply(`⚠️ ${user.name} is already banned`);
  }

  await db.insert(bannedUsersTable).values({
    userId: user.id,
  });

  ctx.reply(`Banned ${user.name} from the bot`);
});

export const banCommand = composer;
