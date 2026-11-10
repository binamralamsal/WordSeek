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

  test("leaderboard responses include Telegram user IDs", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    await seedUser(env.db, { id: "7777", name: "Grace Hopper" });
    await env.db
      .updateTable("users")
      .set({ photoUrl: "https://t.me/i/userpic/320/grace.jpg" })
      .where("id", "=", "7777")
      .execute();
    await env.db
      .updateTable("users")
      .set({ photoUrl: "https://t.me/i/userpic/320/ada.jpg" })
      .where("id", "=", "4242")
      .execute();
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
    expect(body.data.rows.map((row) => row.userId)).toEqual(["7777", "4242"]);
    expect(body.data.rows.map((row) => row.isMe)).toEqual([false, true]);
    expect(body.data.rows.map((row) => row.photoUrl)).toEqual([
      "https://t.me/i/userpic/320/grace.jpg",
      "https://t.me/i/userpic/320/ada.jpg",
    ]);
    expect(body.data.rows.every((row) => typeof row.userId === "string")).toBe(
      true,
    );
  });

  test("players can be found and opened using Telegram IDs", async () => {
    await seedUser(env.db, {
      id: "7777",
      name: "Grace Hopper",
      username: "gracehopper",
    });
    await seedScore(env.db, { userId: "7777", score: 20, wordLength: "5" });
    const auth: AuthContext = {
      userId: "4242",
      user: { id: 4242, first_name: "Ada" },
      group: null,
    };

    const searchResponse = await handleApiRequest(
      new Request("http://localhost/api/profile/search?q=%40gracehopper"),
      auth,
    );
    const searchBody = (await searchResponse.json()) as {
      data: Record<string, unknown>;
    };
    const userId = searchBody.data.id as string;

    expect(searchResponse.status).toBe(200);
    expect(searchBody.data.username).toBe("gracehopper");
    expect(userId).toBe("7777");

    const idSearchResponse = await handleApiRequest(
      new Request("http://localhost/api/profile/search?q=7777"),
      auth,
    );
    const idSearchBody = (await idSearchResponse.json()) as {
      data: Record<string, unknown>;
    };
    expect(idSearchBody.data.id).toBe(userId);

    const profileResponse = await handleApiRequest(
      new Request(`http://localhost/api/profile/${userId}`),
      auth,
    );
    const profileBody = (await profileResponse.json()) as {
      data: {
        user: Record<string, unknown>;
        stats: Record<string, unknown>;
      };
    };

    expect(profileResponse.status).toBe(200);
    expect(profileBody.data.user.displayName).toBe("Grace Hopper");
    expect(profileBody.data.user.id).toBe(userId);
    expect(profileBody.data.stats).not.toHaveProperty("classicWins");

    const rankingResponse = await handleApiRequest(
      new Request(
        `http://localhost/api/profile/${userId}/ranking?scope=global&period=all&length=5`,
      ),
      auth,
    );
    const rankingBody = (await rankingResponse.json()) as {
      data: { rank: number; score: number };
    };

    expect(rankingResponse.status).toBe(200);
    expect(rankingBody.data).toMatchObject({ rank: 1, score: 20 });
  });
});
