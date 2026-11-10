import { describe, expect, test } from "bun:test";

import { handleApiRequest } from "#/web/api";
import type { AuthContext } from "#/web/auth";

import { setupTestEnvironment } from "../helpers/env";
import { seedScore, seedUser } from "../helpers/fixtures";

const env = setupTestEnvironment();

describe("Mini App API", () => {
  test("reading classic lengths never creates game rows", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    const auth: AuthContext = {
      userId: "4242",
      user: { id: 4242, first_name: "Ada" },
      group: null,
    };

    for (const length of [4, 5, 6]) {
      const response = await handleApiRequest(
        new Request(`http://localhost/api/classic?length=${length}`),
        auth,
      );
      const body = (await response.json()) as { data: unknown };

      expect(response.status).toBe(200);
      expect(body.data).toBeNull();
    }

    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
    const startResponse = await handleApiRequest(
      new Request("http://localhost/api/classic/start", { method: "POST" }),
      auth,
    );
    expect(startResponse.status).toBe(404);
  });

  test("leaderboard responses do not expose Telegram user IDs", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    await seedUser(env.db, { id: "7777", name: "Grace Hopper" });
    await seedScore(env.db, { userId: "4242", score: 10, wordLength: "5" });
    await seedScore(env.db, { userId: "7777", score: 20, wordLength: "5" });

    const auth: AuthContext = {
      userId: "4242",
      user: { id: 4242, first_name: "Ada" },
      group: null,
    };
    const response = await handleApiRequest(
      new Request(
        "http://localhost/api/leaderboard?scope=global&period=all&length=5",
      ),
      auth,
    );
    const body = (await response.json()) as {
      data: { rows: Array<Record<string, unknown>> };
    };

    expect(response.status).toBe(200);
    expect(body.data.rows.map((row) => row.displayName)).toEqual([
      "Grace Hopper",
      "Ada Lovelace",
    ]);
    expect(body.data.rows.every((row) => !("userId" in row))).toBe(true);
    expect(body.data.rows.map((row) => row.isMe)).toEqual([false, true]);
  });
});
