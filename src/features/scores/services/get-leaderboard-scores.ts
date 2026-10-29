import { sql } from "kysely";

import { db } from "#/config/db";
import { toDbWordLength } from "#/types";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

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
  let leaderboardQuery = db
    .selectFrom("leaderboard")
    .innerJoin("users", "users.id", "leaderboard.userId")
    .select((eb) => [
      "users.id as userId",
      "users.name as name",
      "users.username as username",
      sql<number>`cast(sum(${eb.ref("leaderboard.score")}) as integer)`.as(
        "totalScore",
      ),
    ])
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("bannedUsers")
            .select("userId")
            .whereRef("bannedUsers.userId", "=", "leaderboard.userId"),
        ),
      ),
    )
    .groupBy("users.id")
    .orderBy(sql`sum(${sql.ref("leaderboard.score")}) desc`)
    .where("leaderboard.wordLength", "=", toDbWordLength(wordLength))
    .limit(20);

  if (searchKey === "group")
    leaderboardQuery = leaderboardQuery.where(
      "leaderboard.chatId",
      "=",
      chatId,
    );

  if (timeKey !== "all") {
    leaderboardQuery = leaderboardQuery.where((eb) => {
      if (timeKey === "today")
        return eb(
          sql`date_trunc('day', ${eb.ref("leaderboard.createdAt")})`,
          "=",
          sql<Date>`date_trunc('day', now())`,
        );
      else if (timeKey === "week")
        return eb(
          sql`date_trunc('week', ${eb.ref("leaderboard.createdAt")})`,
          "=",
          sql<Date>`date_trunc('week', now())`,
        );
      else if (timeKey === "month")
        return eb(
          sql`date_trunc('month', ${eb.ref("leaderboard.createdAt")})`,
          "=",
          sql<Date>`date_trunc('month', now())`,
        );
      else
        return eb(
          sql`date_trunc('year', ${eb.ref("leaderboard.createdAt")})`,
          "=",
          sql<Date>`date_trunc('year', now())`,
        );
    });
  }

  return await leaderboardQuery.execute();
}
