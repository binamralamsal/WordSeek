import { sql } from "kysely";

import { db } from "#/config/db";
import { toDbWordLength } from "#/types";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

import { getPeriodRange } from "../helpers/period-range.helper";

export async function getUserScores({
  chatId,
  searchKey,
  userId,
  timeKey,
  wordLength = 5,
}: {
  chatId: string;
  searchKey: LeaderboardScope;
  userId: string;
  timeKey: LeaderboardPeriod;
  wordLength?: WordLength;
}) {
  const userQuery = db
    .selectFrom((eb) => {
      let innerQuery = eb
        .selectFrom("leaderboard")
        .where(
          "leaderboard.userId",
          "not in",
          eb.selectFrom("bannedUsers").select("userId"),
        )
        .select("leaderboard.userId")
        .select(sql<number>`sum(leaderboard.score)`.as("totalScore"))
        .groupBy("leaderboard.userId")
        .select(
          sql<number>`rank() over (order by sum(leaderboard.score) desc)`.as(
            "rank",
          ),
        )
        .where("leaderboard.wordLength", "=", toDbWordLength(wordLength));

      if (searchKey === "group") {
        innerQuery = innerQuery.where("leaderboard.chatId", "=", chatId);
      }

      const range = getPeriodRange(timeKey);

      if (range) {
        innerQuery = innerQuery
          .where("leaderboard.createdAt", ">=", range.from)
          .where("leaderboard.createdAt", "<", range.to);
      }

      return innerQuery.as("lb");
    })
    .innerJoin("users", "users.id", "lb.userId")
    .leftJoin("userStats", "userStats.userId", "users.id")
    .select([
      "users.id",
      "users.name",
      "users.username",
      "lb.totalScore",
      "lb.rank",
      "userStats.highestStreak",
      "userStats.currentStreak",
    ])
    .where("users.id", "=", userId);

  return await userQuery.executeTakeFirst();
}
