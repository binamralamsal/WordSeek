import { sql } from "kysely";

import { db } from "#/config/db";
import { toDbWordLength } from "#/types";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

import { getPeriodRange } from "../helpers/period-range.helper";

export async function getLeaderboardScores({
  chatId,
  searchKey,
  timeKey,
  wordLength = 5,
}: {
  chatId: string;
  searchKey: LeaderboardScope;
  timeKey: LeaderboardPeriod;
  wordLength?: WordLength;
}) {
  // Aggregate the (potentially many) score rows first and only join `users`
  // for the 20 rows that are actually returned. Joining before aggregating
  // used to touch the users table once per score row.
  let scoreTotalsQuery = db
    .selectFrom("leaderboard")
    .select("leaderboard.userId")
    .select((eb) => [
      sql<number>`cast(sum(${eb.ref("leaderboard.score")}) as integer)`.as(
        "totalScore",
      ),
    ])
    .where("leaderboard.wordLength", "=", toDbWordLength(wordLength))
    .where(
      "leaderboard.userId",
      "not in",
      db.selectFrom("bannedUsers").select("userId"),
    )
    .groupBy("leaderboard.userId")
    .orderBy(sql`sum(${sql.ref("leaderboard.score")}) desc`)
    .limit(20);

  if (searchKey === "group")
    scoreTotalsQuery = scoreTotalsQuery.where(
      "leaderboard.chatId",
      "=",
      chatId,
    );

  const range = getPeriodRange(timeKey);

  if (range) {
    scoreTotalsQuery = scoreTotalsQuery
      .where("leaderboard.createdAt", ">=", range.from)
      .where("leaderboard.createdAt", "<", range.to);
  }

  return await db
    .selectFrom(scoreTotalsQuery.as("totals"))
    .innerJoin("users", "users.id", "totals.userId")
    .select([
      "users.id as userId",
      "users.name as name",
      "users.username as username",
      "totals.totalScore",
    ])
    .orderBy("totals.totalScore", "desc")
    .execute();
}
