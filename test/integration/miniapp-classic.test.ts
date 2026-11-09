import { describe, expect, test } from "bun:test";

import {
  getClassicState,
  startClassicGame,
  submitClassicGuess,
} from "#/features/miniapp/services/classic.service";

import { setupTestEnvironment } from "../helpers/env";
import { seedUser } from "../helpers/fixtures";

const env = setupTestEnvironment();

describe("Mini App classic games", () => {
  test("keeps an independent active game for each length", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });

    const five = await startClassicGame({ userId: "4242", wordLength: 5 });
    const fiveAgain = await startClassicGame({
      userId: "4242",
      wordLength: 5,
    });
    const four = await startClassicGame({ userId: "4242", wordLength: 4 });
    const six = await startClassicGame({ userId: "4242", wordLength: 6 });

    expect(fiveAgain.id).toBe(five.id);
    expect([four.wordLength, five.wordLength, six.wordLength]).toEqual([
      4, 5, 6,
    ]);
    expect((await getClassicState("4242", 5))?.id).toBe(five.id);

    const games = await env.db
      .selectFrom("games")
      .select(["source", "topicId", "gameStatus"])
      .where("source", "=", "miniapp")
      .orderBy("topicId")
      .execute();
    expect(games).toEqual([
      { source: "miniapp", topicId: "classic:4", gameStatus: "active" },
      { source: "miniapp", topicId: "classic:5", gameStatus: "active" },
      { source: "miniapp", topicId: "classic:6", gameStatus: "active" },
    ]);
  });

  test("keeps Mini App games separate from a private bot game", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    await env.db
      .insertInto("games")
      .values({ activeChat: "4242", topicId: "general", word: "apple" })
      .execute();

    const miniAppGame = await startClassicGame({
      userId: "4242",
      wordLength: 5,
    });
    const privateBotGame = await env.db
      .selectFrom("games")
      .select(["id", "source"])
      .where("activeChat", "=", "4242")
      .where("topicId", "=", "general")
      .where("source", "=", "telegram")
      .executeTakeFirstOrThrow();

    expect(privateBotGame.source).toBe("telegram");
    expect(privateBotGame.id).not.toBe(miniAppGame.id);
  });

  test("records Mini App classic completion in shared scores and stats", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    const game = await startClassicGame({ userId: "4242", wordLength: 4 });
    const storedGame = await env.db
      .selectFrom("games")
      .select("word")
      .where("id", "=", game.id)
      .executeTakeFirstOrThrow();

    const result = await submitClassicGuess("4242", storedGame.word, 4);
    expect(result.ok).toBe(true);

    const score = await env.db
      .selectFrom("leaderboard")
      .select(["chatId", "wordLength", "score"])
      .where("userId", "=", "4242")
      .executeTakeFirstOrThrow();
    const stats = await env.db
      .selectFrom("userStats")
      .select("classicGamesWon")
      .where("userId", "=", "4242")
      .executeTakeFirstOrThrow();

    expect(score).toMatchObject({ chatId: "4242", wordLength: "4", score: 30 });
    expect(stats).toEqual({ classicGamesWon: 1 });
  });
});
