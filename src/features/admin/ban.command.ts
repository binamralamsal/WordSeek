import { Composer } from "grammy";

import { db } from "#/config/db";
import { env } from "#/config/env";
import { findUserByIdentifier } from "#/core/services/users.service";

const composer = new Composer();

composer.command("ban", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const user = await findUserByIdentifier(ctx.match);

  if (!user) return ctx.reply("Can't find the user");

  const existingBan = await db
    .selectFrom("bannedUsers")
    .selectAll()
    .where("userId", "=", user.id)
    .executeTakeFirst();

  if (existingBan) {
    return ctx.reply(`⚠️ ${user.name} is already banned`);
  }

  await db
    .insertInto("bannedUsers")
    .values({
      userId: user.id,
    })
    .execute();

  ctx.reply(`Banned ${user.name} from the bot`);
});

export const banCommand = composer;
