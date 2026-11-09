import type { Kysely } from "kysely";

import { db } from "#/config/db";
import type { DB } from "#/database/schema";

export type ClassicOutcome = "won" | "lost";

/** Records one player's completed classic game on the caller's transaction. */
export async function recordClassicResult(
  executor: Kysely<DB>,
  userId: string,
  outcome: ClassicOutcome,
  score: number,
): Promise<void> {
  await executor
    .insertInto("userStats")
    .values({ userId, highestStreak: 0, currentStreak: 0, lastGuessed: null })
    .onConflict((conflict) => conflict.column("userId").doNothing())
    .execute();

  await executor
    .updateTable("userStats")
    .set((eb) => ({
      classicGamesPlayed: eb("classicGamesPlayed", "+", 1),
      classicGamesWon: eb("classicGamesWon", "+", outcome === "won" ? 1 : 0),
      classicGamesLost: eb("classicGamesLost", "+", outcome === "lost" ? 1 : 0),
      classicTotalScore: eb("classicTotalScore", "+", score),
    }))
    .where("userId", "=", userId)
    .execute();
}

/** Daily completion is shared by the chat command and the Mini App API. */
export async function recordDailyResult(
  userId: string,
  won: boolean,
): Promise<void> {
  await db
    .insertInto("userStats")
    .values({ userId, highestStreak: 0, currentStreak: 0, lastGuessed: null })
    .onConflict((conflict) => conflict.column("userId").doNothing())
    .execute();

  await db
    .updateTable("userStats")
    .set((eb) => ({
      dailyGamesPlayed: eb("dailyGamesPlayed", "+", 1),
      dailyGamesWon: eb("dailyGamesWon", "+", won ? 1 : 0),
      dailyGamesLost: eb("dailyGamesLost", "+", won ? 0 : 1),
    }))
    .where("userId", "=", userId)
    .execute();
}
