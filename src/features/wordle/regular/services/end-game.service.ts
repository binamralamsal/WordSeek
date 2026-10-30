import type { Context } from "grammy";

import { db } from "#/config/db";
import { env } from "#/config/env";
import { escapeHtml } from "#/core/format/escape-html.helper";

export async function isUserAuthorized(userId: string, chatId: string) {
  const authorized = await db
    .selectFrom("authorizedUsers")
    .where("userId", "=", userId)
    .where("chatId", "=", chatId)
    .executeTakeFirst();

  return !!authorized;
}

export async function endGame(
  ctx: Context,
  chatId: number,
  word: string,
  reason: string,
) {
  const game = await db
    .deleteFrom("games")
    .where("activeChat", "=", String(chatId))
    .returning("word")
    .executeTakeFirst();

  const wordLength = game?.word ? game.word.length : 5;

  await ctx.replyWithRichMessage({
    html: `<h3>🛑 Game Ended</h3>
<p>The word was <b>${word.toUpperCase()}</b>.</p>
${reason ? `<blockquote>${reason}</blockquote>` : ""}
<p>Start a new game with /new${wordLength}</p>`,
  });
}

export type EndPermission =
  { permitted: true; reason: string } | { permitted: false };

export async function getEndPermission(
  ctx: Context,
  userId: string,
  startedBy: string | null,
): Promise<EndPermission> {
  if (!ctx.from || !ctx.chat) return { permitted: false };

  const chatMember = await ctx.getChatMember(parseInt(userId));

  const isAdmin =
    chatMember.status === "administrator" || chatMember.status === "creator";
  const isSystemAdmin = env.ADMIN_USERS.includes(ctx.from.id);
  const isGameStarter = startedBy === userId;
  const isAuthorized = await isUserAuthorized(userId, ctx.chat.id.toString());
  const isPrivate = ctx.chat.type === "private";

  const isPermitted =
    isAdmin || isSystemAdmin || isGameStarter || isAuthorized || isPrivate;

  if (!isPermitted) return { permitted: false };

  const userName =
    ctx.from.first_name + (ctx.from.last_name ? " " + ctx.from.last_name : "");
  const userLink = `<a href="tg://user?id=${ctx.from.id}">${escapeHtml(userName)}</a>`;

  let reason = "";

  if (isPrivate) {
    reason = "";
  } else if (isGameStarter) {
    reason = `<b>Ended by game starter: </b>${userLink}`;
  } else if (isSystemAdmin) {
    reason = `<b>Ended by system administrator: </b>${userLink}`;
  } else if (isAdmin) {
    reason = `<b>Ended by group administrator: </b>${userLink}`;
  } else if (isAuthorized) {
    reason = `<b>Ended by authorized user: </b>${userLink}`;
  } else {
    reason = `<b>Ended by: </b>${userLink}`;
  }

  return { permitted: true, reason };
}
