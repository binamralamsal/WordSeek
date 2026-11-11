import { expect, test } from "bun:test";
import { sql } from "kysely";

import {
  down as rollbackMiniAppMigration,
  up as applyMiniAppMigration,
} from "../../migrations/1794400000000_miniapp";
import { setupTestEnvironment } from "../helpers/env";
import { seedScore, seedUser } from "../helpers/fixtures";

const env = setupTestEnvironment();

test("uses an enum source and keeps classic guess metadata out of storage", async () => {
  const sourceColumn = await sql<{ dataType: string; udtName: string }>`
    SELECT data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'source'
  `.execute(env.db);
  const classicColumns = await sql<{ columnName: string }>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'games'
      AND column_name IN ('attempts_used', 'score', 'finished_at', 'game_status')
  `.execute(env.db);
  const guessColumns = await sql<{ columnName: string }>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'guesses'
      AND column_name IN ('user_id', 'attempt_number')
  `.execute(env.db);

  expect(sourceColumn.rows).toEqual([
    { dataType: "USER-DEFINED", udtName: "game_source" },
  ]);
  expect(classicColumns.rows).toEqual([]);
  expect(guessColumns.rows).toEqual([]);
});

test("estimates compacted classic wins and backfills completed daily totals", async () => {
  await seedUser(env.db, { id: "compact", name: "Compact" });
  await seedUser(env.db, { id: "daily-win", name: "Daily win" });
  await seedUser(env.db, { id: "daily-loss", name: "Daily loss" });
  await seedUser(env.db, { id: "unfinished", name: "Unfinished" });
  await seedUser(env.db, { id: "legacy-active", name: "Legacy active" });
  await seedScore(env.db, { userId: "compact", score: 20 });
  await seedScore(env.db, { userId: "compact", score: 80 });

  await rollbackMiniAppMigration(env.db);
  await rollbackMiniAppMigration(env.db);

  await sql`
    CREATE TABLE mini_app_games (
      id integer PRIMARY KEY,
      user_id text NOT NULL,
      word varchar(6) NOT NULL,
      word_length text NOT NULL,
      status varchar(10) NOT NULL,
      started_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `.execute(env.db);
  await sql`
    CREATE TABLE mini_app_guesses (
      id integer PRIMARY KEY,
      game_id integer NOT NULL,
      guess varchar(6) NOT NULL,
      attempt_number integer NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `.execute(env.db);
  await sql`
    INSERT INTO mini_app_games
      (id, user_id, word, word_length, status, started_at, updated_at)
    VALUES
      (1, 'legacy-active', 'crane', '5', 'active', now(), now()),
      (2, 'compact', 'crane', '5', 'won', now(), now())
  `.execute(env.db);
  await sql`
    INSERT INTO mini_app_guesses
      (id, game_id, guess, attempt_number, created_at, updated_at)
    VALUES
      (1, 1, 'slate', 1, now(), now()),
      (2, 1, 'proud', 2, now() + interval '1 second', now())
  `.execute(env.db);

  const daily = await env.db
    .insertInto("dailyWords")
    .values({
      dayNumber: 1,
      word: "crane",
      date: new Date("2026-01-01T00:00:00.000Z"),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const dailyGuesses = [
    { userId: "daily-win", guess: "slate", attemptNumber: 1 },
    { userId: "daily-win", guess: "crane", attemptNumber: 2 },
    { userId: "daily-loss", guess: "slate", attemptNumber: 1 },
    { userId: "daily-loss", guess: "proud", attemptNumber: 2 },
    { userId: "daily-loss", guess: "thing", attemptNumber: 3 },
    { userId: "daily-loss", guess: "cabin", attemptNumber: 4 },
    { userId: "daily-loss", guess: "sword", attemptNumber: 5 },
    { userId: "daily-loss", guess: "light", attemptNumber: 6 },
    { userId: "unfinished", guess: "slate", attemptNumber: 1 },
    { userId: "unfinished", guess: "proud", attemptNumber: 2 },
  ];

  await env.db
    .insertInto("dailyGuesses")
    .values(dailyGuesses.map((guess) => ({ ...guess, dailyWordId: daily.id })))
    .execute();

  await applyMiniAppMigration(env.db);

  const migratedGame = await env.db
    .selectFrom("games")
    .select(["activeChat", "topicId", "word", "source"])
    .where("startedBy", "=", "legacy-active")
    .executeTakeFirstOrThrow();
  const migratedGuesses = await env.db
    .selectFrom("guesses")
    .select(["guess", "chatId"])
    .orderBy("createdAt")
    .execute();
  const legacyTables = await sql<{ tableName: string }>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('mini_app_games', 'mini_app_guesses')
  `.execute(env.db);

  expect(migratedGame).toEqual({
    activeChat: "miniapp:legacy-active",
    topicId: "classic:5",
    word: "crane",
    source: "miniapp",
  });
  expect(migratedGuesses).toEqual([
    { guess: "slate", chatId: "miniapp:legacy-active" },
    { guess: "proud", chatId: "miniapp:legacy-active" },
  ]);
  expect(legacyTables.rows).toEqual([]);

  const compactStats = await env.db
    .selectFrom("userStats")
    .select("classicGamesWon")
    .where("userId", "=", "compact")
    .executeTakeFirstOrThrow();
  const solvedStats = await env.db
    .selectFrom("userStats")
    .select(["dailyGamesPlayed", "dailyGamesWon", "dailyGamesLost"])
    .where("userId", "=", "daily-win")
    .executeTakeFirstOrThrow();
  const lostStats = await env.db
    .selectFrom("userStats")
    .select(["dailyGamesPlayed", "dailyGamesWon", "dailyGamesLost"])
    .where("userId", "=", "daily-loss")
    .executeTakeFirstOrThrow();
  const unfinishedStats = await env.db
    .selectFrom("userStats")
    .select(["dailyGamesPlayed", "dailyGamesWon", "dailyGamesLost"])
    .where("userId", "=", "unfinished")
    .executeTakeFirstOrThrow();

  expect(compactStats).toEqual({ classicGamesWon: 5 });
  expect(solvedStats).toEqual({
    dailyGamesPlayed: 1,
    dailyGamesWon: 1,
    dailyGamesLost: 0,
  });
  expect(lostStats).toEqual({
    dailyGamesPlayed: 1,
    dailyGamesWon: 0,
    dailyGamesLost: 1,
  });
  expect(unfinishedStats).toEqual({
    dailyGamesPlayed: 0,
    dailyGamesWon: 0,
    dailyGamesLost: 0,
  });
});
