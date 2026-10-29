import type { Context } from "grammy";

export function isForumGroup(ctx: Context) {
  return !!ctx.chat?.is_forum;
}

export function getCurrentTopicId(ctx: Context) {
  return ctx.msg?.message_thread_id?.toString() || "general";
}
