import type { Context } from "grammy";

export type GuardResult = { ok: true } | { ok: false; message: string };

export type Guard = (ctx: Context) => Promise<GuardResult>;

export async function requireAdmin(ctx: Context): Promise<GuardResult> {
  if (!ctx.chat || !ctx.from) return { ok: true };

  if (ctx.chat.type === "private") return { ok: true };

  try {
    const chatMember = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);

    const allowedStatus = ["administrator", "creator"];

    if (!allowedStatus.includes(chatMember.status)) {
      return {
        ok: false,
        message: "Only admins can use this command.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "⚠️ I couldn't verify admin rights.\n" +
        "👉 Please make sure I’m an admin in this group.",
    };
  }
}

export async function runGuards(
  ctx: Context,
  guards: Guard[],
): Promise<GuardResult> {
  for (const guard of guards) {
    const result = await guard(ctx);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export const adminOnlyGuards = [requireAdmin];
