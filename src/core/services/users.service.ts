import type { Context } from "grammy";

import { sql } from "kysely";

import { db } from "#/config/db";
import { formatDisplayName } from "#/core/format/mention.helper";

export type UserRecord = {
  id: string;
  name: string;
  username: string | null;
};

export async function upsertUser(user: UserRecord) {
  await db
    .insertInto("users")
    .values(user)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        name: user.name,
        username: user.username,
      }),
    )
    .execute();
}

export async function upsertBroadcastChat(chat: {
  id: string;
  name: string | null;
  username: string | null;
}) {
  await db
    .insertInto("broadcastChats")
    .values(chat)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        name: chat.name,
        username: chat.username,
      }),
    )
    .execute();
}

export async function findUserById(id: string) {
  return await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function findUserByIdentifier(identifier: string) {
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
}

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
      name: formatDisplayName(user),
      username: user.username,
    };
  }

  const replyToMessage = ctx.message?.reply_to_message;
  const replyToMessageFrom = replyToMessage?.from;

  if (
    replyToMessageFrom &&
    !replyToMessageFrom.is_bot &&
    !replyToMessage.is_topic_message
  ) {
    const user = replyToMessageFrom;

    return {
      id: user.id.toString(),
      name: formatDisplayName(user),
      username: user.username,
    };
  }

  if (fallback && !identifier) {
    const user = ctx.from;

    if (!user) return null;

    return {
      id: user.id.toString(),
      name: formatDisplayName(user),
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
        name: formatDisplayName(user),
        username: user.username ?? null,
      };

      await upsertUser(userData);
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
          name: formatDisplayName(member.user),
          username: member.user.username,
        };
      }
    } catch {
      // Fall through to database
    }

    const user = await findUserById(identifier);

    return user || null;
  }

  return null;
}
