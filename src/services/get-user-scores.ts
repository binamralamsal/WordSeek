import { sql } from "kysely";

import { db } from "../config/db";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

export async function getUserScores({
  chatId,
  searchKey,
  userId,
  timeKey,
}: {
  chatId: string;
  searchKey: AllowedChatSearchKey;
  userId: string;
  timeKey: AllowedChatTimeKey;
}) {
  const userQuery = db
    .selectFrom((eb) => {
      let innerQuery = eb
        .selectFrom("leaderboard")
        .select("leaderboard.userId")
        .select(sql<number>`sum(leaderboard.score)`.as("totalScore"))
        .groupBy("leaderboard.userId")
        .select(
          sql<number>`rank() over (order by sum(leaderboard.score) desc)`.as(
            "rank",
          ),
        );

      if (searchKey === "group") {
        innerQuery = innerQuery.where("leaderboard.chatId", "=", chatId);
      }

      if (timeKey !== "all") {
        innerQuery = innerQuery.where((eb) => {
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

      return innerQuery.as("lb");
    })
    .innerJoin("users", "users.id", "lb.userId")
    .select([
      "users.id",
      "users.name",
      "users.username",
      "lb.totalScore",
      "lb.rank",
    ])
    .where("users.id", "=", userId);

  return await userQuery.executeTakeFirst();
}
