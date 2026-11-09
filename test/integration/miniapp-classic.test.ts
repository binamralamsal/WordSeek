import { describe, expect, test } from "bun:test";

import { startClassicGame } from "#/features/miniapp/services/classic.service";

import { setupTestEnvironment } from "../helpers/env";
import { seedUser } from "../helpers/fixtures";

const env = setupTestEnvironment();

describe("Mini App classic game", () => {
  test("switching word length replaces the active game", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });

    const first = await startClassicGame({
      userId: "4242",
      wordLength: 5,
      chatId: "4242",
    });
    const next = await startClassicGame({
      userId: "4242",
      wordLength: 6,
      chatId: "4242",
    });

    expect(first?.wordLength).toBe(5);
    expect(next?.wordLength).toBe(6);
    expect(next?.id).not.toBe(first?.id);

    const rows = await env.db
      .selectFrom("miniAppGames")
      .select(["wordLength", "status"])
      .orderBy("id", "asc")
      .execute();

    expect(rows).toEqual([
      { wordLength: "5", status: "lost" },
      { wordLength: "6", status: "active" },
    ]);
  });
});
