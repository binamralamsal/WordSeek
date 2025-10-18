import { Composer } from "grammy";

import { eq } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../drizzle/db";
import { bannedUsersTable, usersTable } from "../drizzle/schema";

const composer = new Composer();

composer.command("unban", async (ctx) => {
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

  if (!existingBan) {
    return ctx.reply(`⚠️ ${user.name} is not banned`);
  }

  await db.delete(bannedUsersTable).where(eq(bannedUsersTable.userId, user.id));

  ctx.reply(`Unbanned ${user.name} from the bot`);
});

export const unbanCommand = composer;
