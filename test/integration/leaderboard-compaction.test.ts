import { describe, expect, test } from "bun:test";
import { sql } from "kysely";

import { getLeaderboardScores } from "#/features/scores/services/get-leaderboard-scores.service";
import { getUserScores } from "#/features/scores/services/get-user-scores.service";
import { compactLeaderboard } from "#/features/scores/services/leaderboard-compaction.service";
import { LEADERBOARD_PERIODS, WORD_LENGTHS } from "#/types";

import { setupTestEnvironment } from "../helpers/env";
import { seedScore, seedUser } from "../helpers/fixtures";

const env = setupTestEnvironment();

const CHAT_ID = "-1000000000123";
const OTHER_CHAT_ID = "-1000000000456";
const USER_A = "9101";
const USER_B = "9102";
const BANNED_USER = "9103";
const DAY_MS = 24 * 60 * 60 * 1000;

interface Boundaries {
  dayStart: Date;
  weekStart: Date;
  monthStart: Date;
  yearStart: Date;
}

async function getBoundaries(now: Date = new Date()): Promise<Boundaries> {
  const result = await sql<Boundaries>`
    SELECT
      date_trunc('day', ${now}::timestamptz) AS "dayStart",
      date_trunc('week', ${now}::timestamptz) AS "weekStart",
      date_trunc('month', ${now}::timestamptz) AS "monthStart",
      date_trunc('year', ${now}::timestamptz) AS "yearStart"
  `.execute(env.db);

  return result.rows[0]!;
}

function normalizeRows(rows: Awaited<ReturnType<typeof getLeaderboardScores>>) {
  return [...rows].sort((a, b) => a.userId.localeCompare(b.userId));
}

async function snapshot(chatId: string, userIds: string[]) {
  const leaderboards: unknown[] = [];

  for (const searchKey of ["global", "group"] as const) {
    for (const timeKey of LEADERBOARD_PERIODS) {
      for (const wordLength of WORD_LENGTHS) {
        const rows = await getLeaderboardScores({
          chatId,
          searchKey,
          timeKey,
          wordLength,
        });

        leaderboards.push({
          searchKey,
          timeKey,
          wordLength,
          rows: normalizeRows(rows),
        });
      }
    }
  }

  const userScores: unknown[] = [];

  for (const userId of userIds) {
    for (const searchKey of ["global", "group"] as const) {
      for (const timeKey of LEADERBOARD_PERIODS) {
        for (const wordLength of WORD_LENGTHS) {
          userScores.push({
            userId,
            searchKey,
            timeKey,
            wordLength,
            row: await getUserScores({
              chatId,
              userId,
              searchKey,
              timeKey,
              wordLength,
            }),
          });
        }
      }
    }
  }

  return { leaderboards, userScores };
}

async function countRows(): Promise<number> {
  const result = await sql<{ count: number }>`
    SELECT count(*)::integer AS count FROM leaderboard
  `.execute(env.db);

  return result.rows[0]!.count;
}

async function countRowsSince(date: Date): Promise<number> {
  const result = await sql<{ count: number }>`
    SELECT count(*)::integer AS count
    FROM leaderboard
    WHERE created_at >= ${date}
  `.execute(env.db);

  return result.rows[0]!.count;
}

describe("leaderboard compaction", () => {
  test("preserves every leaderboard and per-user filter", async () => {
    const now = new Date();
    const { dayStart, weekStart, monthStart, yearStart } =
      await getBoundaries();

    await seedUser(env.db, { id: USER_A, name: "Ada", username: "ada" });
    await seedUser(env.db, { id: USER_B, name: "Grace", username: "grace" });
    await seedUser(env.db, {
      id: BANNED_USER,
      name: "Banned",
      username: "banned",
    });
    await env.db
      .insertInto("bannedUsers")
      .values({ userId: BANNED_USER })
      .execute();

    // One timestamp on each side of every period boundary, plus a date from
    // previous years. This populates every compaction bucket, including the
    // ranges created when weeks cross month/year boundaries.
    const dates = [
      new Date(yearStart.getTime() - 40 * DAY_MS),
      new Date(yearStart.getTime() - 1000),
      new Date(yearStart.getTime() + 1000),
      new Date(monthStart.getTime() - 1000),
      new Date(monthStart.getTime() + 1000),
      new Date(weekStart.getTime() - 1000),
      new Date(weekStart.getTime() + 1000),
      new Date(dayStart.getTime() - 1000),
      new Date(dayStart.getTime() + 1000),
    ].filter((date) => date.getTime() <= now.getTime());

    let score = 1;

    for (const createdAt of dates) {
      for (const userId of [USER_A, USER_B, BANNED_USER]) {
        for (const wordLength of ["4", "5", "6"] as const) {
          for (const chatId of [CHAT_ID, OTHER_CHAT_ID]) {
            await seedScore(env.db, {
              userId,
              chatId,
              wordLength,
              score: (score % 23) + 1,
              createdAt,
            });
            score += 1;
          }
        }
      }
    }

    const rowsBefore = await countRows();
    const currentMonthRowsBefore = await countRowsSince(monthStart);
    const before = await snapshot(CHAT_ID, [USER_A, USER_B]);

    expect(currentMonthRowsBefore).toBeGreaterThan(0);

    const result = await compactLeaderboard();

    expect(result).not.toBeNull();
    expect(result!.rowsRemoved).toBeGreaterThan(0);

    const rowsAfterFirstRun = await countRows();
    expect(rowsAfterFirstRun).toBeLessThan(rowsBefore);

    // Rows from the current month are kept as-is so recent score history stays
    // visible.
    expect(await countRowsSince(monthStart)).toBe(currentMonthRowsBefore);

    const after = await snapshot(CHAT_ID, [USER_A, USER_B]);
    expect(after).toEqual(before);

    // Merging is idempotent: a second pass finds nothing left to combine.
    const secondRun = await compactLeaderboard();
    expect(secondRun!.rowsRemoved).toBe(0);
    expect(await countRows()).toBe(rowsAfterFirstRun);
  });

  test("handles a week crossing both the year and the month boundary", async () => {
    // Friday 3 January 2025. The current week starts on Monday 30 December
    // 2024, so it crosses both the year and the month boundary.
    const now = new Date("2025-01-03T12:00:00.000Z");

    await seedUser(env.db, { id: USER_A, name: "Ada", username: "ada" });

    const scores = [
      { date: "2024-12-29T12:00:00.000Z", score: 1 }, // all time only
      { date: "2024-12-30T12:00:00.000Z", score: 2 }, // week + all
      { date: "2024-12-31T12:00:00.000Z", score: 3 }, // week + all
      { date: "2025-01-01T12:00:00.000Z", score: 4 }, // week + month + year
      { date: "2025-01-02T12:00:00.000Z", score: 5 }, // week + month + year
      { date: "2025-01-03T06:00:00.000Z", score: 6 }, // today + everything
    ];

    for (const entry of scores) {
      await seedScore(env.db, {
        userId: USER_A,
        chatId: CHAT_ID,
        wordLength: "5",
        score: entry.score,
        createdAt: new Date(entry.date),
      });
    }

    const before = await periodTotals(now);
    expect(before).toEqual({
      today: 6,
      week: 20,
      month: 15,
      year: 15,
      all: 21,
    });

    const result = await compactLeaderboard({ now });
    // Only the two December rows share a filter bucket. January rows are in
    // the current month and must stay untouched.
    expect(result!.rowsRemoved).toBe(1);

    // Five rows remain: the old row, the merged week row, and every January
    // row exactly as it was recorded.
    const remaining = await sql<{
      createdAt: Date;
      score: number;
    }>`
      SELECT created_at, score
      FROM leaderboard
      WHERE user_id = ${USER_A} AND chat_id = ${CHAT_ID} AND word_length = '5'
      ORDER BY created_at
    `.execute(env.db);

    expect(remaining.rows.map((row) => row.score)).toEqual([1, 5, 4, 5, 6]);
    expect(remaining.rows.map((row) => row.createdAt.toISOString())).toEqual([
      "2024-12-29T12:00:00.000Z",
      "2024-12-30T12:00:00.000Z",
      "2025-01-01T12:00:00.000Z",
      "2025-01-02T12:00:00.000Z",
      "2025-01-03T06:00:00.000Z",
    ]);

    expect(await periodTotals(now)).toEqual(before);
  });
});

async function periodTotals(
  now: Date,
): Promise<Record<"today" | "week" | "month" | "year" | "all", number>> {
  const total = async (unit: "day" | "week" | "month" | "year" | null) => {
    const constraint =
      unit === null
        ? sql`TRUE`
        : sql`created_at >= date_trunc(${unit}::text, ${now}::timestamptz)
            AND created_at < date_trunc(${unit}::text, ${now}::timestamptz)
              + (${`1 ${unit}`})::interval`;

    const result = await sql<{ total: number }>`
      SELECT COALESCE(sum(score), 0)::integer AS total
      FROM leaderboard
      WHERE user_id = ${USER_A}
        AND chat_id = ${CHAT_ID}
        AND word_length = '5'
        AND ${constraint}
    `.execute(env.db);

    return result.rows[0]!.total;
  };

  return {
    today: await total("day"),
    week: await total("week"),
    month: await total("month"),
    year: await total("year"),
    all: await total(null),
  };
}
