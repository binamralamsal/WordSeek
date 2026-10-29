import type { Context } from "grammy";

import { describe, expect, test } from "bun:test";

import {
  adminOnlyGuards,
  type Guard,
  requireAdmin,
  runGuards,
} from "#/core/guards/admin.guard";

function context(overrides: Record<string, unknown>): Context {
  return overrides as unknown as Context;
}

describe("requireAdmin", () => {
  test("allows private chats", async () => {
    const ctx = context({ chat: { id: 1, type: "private" }, from: { id: 2 } });
    expect(await requireAdmin(ctx)).toEqual({ ok: true });
  });

  test("allows group administrators and creators", async () => {
    for (const status of ["administrator", "creator"]) {
      const ctx = context({
        chat: { id: -1, type: "supergroup" },
        from: { id: 2 },
        api: {
          getChatMember: async () => ({ status }),
        },
      });

      expect(await requireAdmin(ctx)).toEqual({ ok: true });
    }
  });

  test("rejects regular group members", async () => {
    const ctx = context({
      chat: { id: -1, type: "supergroup" },
      from: { id: 2 },
      api: {
        getChatMember: async () => ({ status: "member" }),
      },
    });

    expect(await requireAdmin(ctx)).toEqual({
      ok: false,
      message: "Only admins can use this command.",
    });
  });

  test("reports a friendly message when membership cannot be checked", async () => {
    const ctx = context({
      chat: { id: -1, type: "supergroup" },
      from: { id: 2 },
      api: {
        getChatMember: async () => {
          throw new Error("boom");
        },
      },
    });

    const result = await requireAdmin(ctx);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain(
      "couldn't verify admin rights",
    );
  });

  test("returns ok when chat or sender is missing", async () => {
    expect(await requireAdmin(context({}))).toEqual({ ok: true });
  });
});

describe("runGuards", () => {
  test("stops at the first failing guard", async () => {
    const calls: string[] = [];

    const pass: Guard = async () => {
      calls.push("pass");
      return { ok: true };
    };
    const fail: Guard = async () => {
      calls.push("fail");
      return { ok: false, message: "nope" };
    };
    const never: Guard = async () => {
      calls.push("never");
      return { ok: true };
    };

    expect(await runGuards(context({}), [pass, fail, never])).toEqual({
      ok: false,
      message: "nope",
    });
    expect(calls).toEqual(["pass", "fail"]);
  });

  test("returns ok when every guard passes", async () => {
    expect(await runGuards(context({}), adminOnlyGuards)).toEqual({ ok: true });
  });
});
