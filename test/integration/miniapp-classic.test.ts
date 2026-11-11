import { describe, expect, test } from "bun:test";

import {
  abandonClassicGame,
  getClassicState,
  getClassicStates,
  startClassicGame,
  submitClassicGuess,
} from "#/features/miniapp/services/classic.service";
import { ALL_WORDS } from "#/features/wordle/shared/helpers/words.helper";

import { setupTestEnvironment } from "../helpers/env";
import { seedUser } from "../helpers/fixtures";

const env = setupTestEnvironment();

describe("Mini App classic games", () => {
  test("loads every length without creating games for empty lengths", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    const active = await startClassicGame({ userId: "4242", wordLength: 5 });

    const states = await getClassicStates("4242");

    expect(states[4]).toBeNull();
    expect(states[5]?.id).toBe(active.id);
    expect(states[6]).toBeNull();
    expect(
      await env.db
        .selectFrom("games")
        .where("source", "=", "miniapp")
        .execute(),
    ).toHaveLength(1);
  });

  test("creates its first game only when a valid guess is submitted", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });

    expect(await getClassicStates("4242")).toEqual({
      4: null,
      5: null,
      6: null,
    });
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );

    const result = await submitClassicGuess("4242", ALL_WORDS[4][0]!, 4);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.guesses).toHaveLength(1);
    expect(
      await env.db
        .selectFrom("games")
        .selectAll()
        .execute()
        .then((games) => games.length),
    ).toBeLessThanOrEqual(1);
  });

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
      .select(["source", "topicId"])
      .where("source", "=", "miniapp")
      .orderBy("topicId")
      .execute();
    expect(games).toEqual([
      { source: "miniapp", topicId: "classic:4" },
      { source: "miniapp", topicId: "classic:5" },
      { source: "miniapp", topicId: "classic:6" },
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
    expect(result).toMatchObject({
      ok: true,
      state: {
        status: "won",
        solution: storedGame.word,
        guesses: [{ guess: storedGame.word }],
      },
    });
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
    expect(
      await env.db.selectFrom("guesses").selectAll().execute(),
    ).toHaveLength(0);
    expect(await getClassicState("4242", 4)).toBeNull();
  });

  test("deletes the game and guesses after the thirtieth wrong guess", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    const game = await startClassicGame({ userId: "4242", wordLength: 4 });
    const storedGame = await env.db
      .selectFrom("games")
      .select("word")
      .where("id", "=", game.id)
      .executeTakeFirstOrThrow();
    const wrongWords = ALL_WORDS[4]
      .filter((word) => word !== storedGame.word)
      .slice(0, 30);
    let result: Awaited<ReturnType<typeof submitClassicGuess>> | undefined;

    for (const guess of wrongWords) {
      result = await submitClassicGuess("4242", guess, 4);
    }

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.state.status).toBe("lost");
      expect(result.state.guesses).toHaveLength(30);
    }
    expect(await env.db.selectFrom("games").selectAll().execute()).toHaveLength(
      0,
    );
    expect(
      await env.db.selectFrom("guesses").selectAll().execute(),
    ).toHaveLength(0);
  });

  test("deletes an abandoned game and its guesses", async () => {
    await seedUser(env.db, { id: "4242", name: "Ada Lovelace" });
    const game = await startClassicGame({ userId: "4242", wordLength: 4 });
    const storedGame = await env.db
      .selectFrom("games")
      .select("word")
      .where("id", "=", game.id)
      .executeTakeFirstOrThrow();

    const wrongGuess = ALL_WORDS[4].find((word) => word !== storedGame.word)!;
    await submitClassicGuess("4242", wrongGuess, 4);
    const ended = await abandonClassicGame("4242", 4);

    expect(ended?.status).toBe("lost");
    expect(ended?.solution).toBe(storedGame.word);
    expect(ended?.guesses).toHaveLength(1);

    expect(
      await env.db.selectFrom("games").where("id", "=", game.id).execute(),
    ).toHaveLength(0);
    expect(
      await env.db
        .selectFrom("guesses")
        .where("gameId", "=", game.id)
        .execute(),
    ).toHaveLength(0);
  });
});
