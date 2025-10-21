import { Composer, Context } from "grammy";

import { sql } from "kysely";

import { db } from "../config/db";
import { env } from "../config/env";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

export async function getTargetUser(
  ctx: Context,
  identifier: string | undefined,
  fallback = false,
) {
  if (
    fallback &&
    !identifier &&
    ctx.from &&
    ctx.chatId?.toString() === ctx.from.id.toString()
  ) {
    const user = ctx.from;

    return {
      id: user.id.toString(),
      name: user.first_name + (user.last_name ? " " + user.last_name : ""),
      username: user.username,
    };
  }

  const replyToMessageFrom = ctx.message?.reply_to_message?.from;

  if (replyToMessageFrom && !replyToMessageFrom.is_bot) {
    const user = replyToMessageFrom;

    return {
      id: user.id.toString(),
      name: user.first_name + (user.last_name ? " " + user.last_name : ""),
      username: user.username,
    };
  }

  if (fallback && !identifier) {
    const user = ctx.from;

    if (!user) return null;

    return {
      id: user.id.toString(),
      name: user.first_name + (user.last_name ? " " + user.last_name : ""),
      username: user.username,
    };
  }

  const entities = ctx.message?.entities || [];
  const cmdEntity = entities.find((e) => e.type === "bot_command");
  const argStart = (cmdEntity?.length || 0) + 1;

  for (const entity of entities) {
    if (entity.offset < argStart) continue;

    if (entity.type === "text_mention") {
      const user = entity.user;
      const userData = {
        id: user.id.toString(),
        name: user.first_name + (user.last_name ? " " + user.last_name : ""),
        username: user.username,
      };

      await db
        .insertInto("users")
        .values(userData)
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: userData.name,
            username: userData.username,
          }),
        )
        .execute();
      return userData;
    }

    if (identifier && entity.type === "mention") {
      const username = identifier.slice(1);

      const user = await db
        .selectFrom("users")
        .select(["id", "name", "username"])
        .where(sql`lower(username)`, "=", username.toLowerCase())
        .executeTakeFirst();

      return user || null;
    }
  }

  if (identifier && /^\d+$/.test(identifier)) {
    try {
      const member = await ctx.getChatMember(parseInt(identifier));
      if (member.user) {
        return {
          id: member.user.id.toString(),
          name:
            member.user.first_name +
            (member.user.last_name ? " " + member.user.last_name : ""),
          username: member.user.username,
        };
      }
    } catch {
      // Fall through to database
    }

    const user = await db
      .selectFrom("users")
      .select(["id", "name", "username"])
      .where("id", "=", identifier)
      .executeTakeFirst();

    return user || null;
  }

  return null;
}

composer.command("seekauth", async (ctx) => {
  if (!ctx.chat || !ctx.from) return;

  const chatId = ctx.chat.id.toString();
  const userId = ctx.from.id;
  const chatMember = await ctx.getChatMember(userId);
  const isAdmin =
    chatMember.status === "administrator" || chatMember.status === "creator";
  const isSystemAdmin = env.ADMIN_USERS.includes(userId);

  const replyConfig = {
    reply_to_message_id: ctx.msgId,
    parse_mode: "HTML" as const,
  };

  if (!isAdmin && !isSystemAdmin) {
    return await ctx.reply(
      "❌ You don't have permission to use this command. Only administrators can manage authorized users.",
      replyConfig,
    );
  }

  const args = ctx.match?.trim();

  const parts = args.split(" ");
  const action = parts[0]!.toLowerCase();

  if (action === "list") {
    const authorizedUsers = await db
      .selectFrom("authorizedUsers")
      .innerJoin("users", "users.id", "authorizedUsers.userId")
      .where("authorizedUsers.chatId", "=", chatId)
      .select(["users.id", "users.name", "users.username"])
      .execute();

    if (authorizedUsers.length === 0) {
      return await ctx.reply(
        "📋 No authorized users in this chat.",
        replyConfig,
      );
    }

    const userList = authorizedUsers
      .map(
        (user) =>
          `• <a href="tg://user?id=${user.id}">${user.name}</a>${user.username ? ` (@${user.username})` : ""}`,
      )
      .join("\n");

    return await ctx.reply(
      `<b>🔐 Authorized Users for Hush Game</b>\n\n${userList}`,
      replyConfig,
    );
  }

  if (action === "remove") {
    const targetUser = await getTargetUser(ctx, parts[1]!);

    if (!targetUser) {
      return await ctx.reply("❌ User not found.", replyConfig);
    }

    const deleted = await db
      .deleteFrom("authorizedUsers")
      .where("chatId", "=", chatId)
      .where("userId", "=", targetUser.id)
      .executeTakeFirst();

    if (deleted.numDeletedRows === 0n) {
      return await ctx.reply("❌ This user is not authorized.", replyConfig);
    }

    const userName = targetUser.username
      ? `@${targetUser.username} (${targetUser.name})`
      : targetUser.name;

    return await ctx.reply(
      `✅ <b>${userName}</b> is no longer authorized to end the game.`,
      replyConfig,
    );
  }

  const targetUser = await getTargetUser(ctx, action);

  if (!targetUser) {
    return await ctx.reply(
      "❌ Could not identify the user. Please mention with @username, provide user ID, or reply to their message.",
      replyConfig,
    );
  }

  const existing = await db
    .selectFrom("authorizedUsers")
    .where("chatId", "=", chatId)
    .where("userId", "=", targetUser.id)
    .executeTakeFirst();

  if (existing) {
    return await ctx.reply(
      `⚠️ <b>${targetUser.name}</b> is already authorized to end the game in this chat.`,
      replyConfig,
    );
  }

  await db
    .insertInto("authorizedUsers")
    .values({
      chatId,
      userId: targetUser.id,
      authorizedBy: userId.toString(),
    })
    .execute();

  const userName = targetUser.username
    ? `@${targetUser.username} (${targetUser.name})`
    : targetUser.name;

  return await ctx.reply(
    `✅ <b>${userName}</b> is now authorized to end the game without voting!`,
    replyConfig,
  );
});

CommandsHelper.addNewCommand(
  "seekauth",
  "Manage users authorized to end the hush game (admin only)",
);

export const seekAuthCommand = composer;
