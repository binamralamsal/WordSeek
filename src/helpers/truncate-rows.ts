// @ts-nocheck
import { and, eq, lt, ne, sql } from "drizzle-orm";

import { db } from "../drizzle/db";
import { leaderboardTable } from "../drizzle/schema";

await db.transaction(async (trx: any) => {
  // Step 1: Create temporary table for first items per user and chat_id
  await trx.execute(sql`
      CREATE TEMPORARY TABLE first_items AS
      SELECT DISTINCT ON (user_id, chat_id) id, user_id, chat_id, score, created_at
      FROM ${leaderboardTable}
      WHERE created_at < DATE_TRUNC('year', CURRENT_DATE)
      ORDER BY user_id, chat_id, created_at;
    `);

  // Step 2: Create temporary table for total scores per user and chat_id
  await trx.execute(sql`
      CREATE TEMPORARY TABLE user_totals AS
      SELECT user_id, chat_id, SUM(score) AS total_score
      FROM ${leaderboardTable}
      WHERE created_at < DATE_TRUNC('year', CURRENT_DATE)
      AND id NOT IN (SELECT id FROM first_items)
      GROUP BY user_id, chat_id;
    `);

  // Step 3: Create index for better join performance
  await trx.execute(sql`
      CREATE INDEX ON user_totals(user_id, chat_id);
    `);

  // Step 4: Update scores using a direct join based on user_id and chat_id
  await trx.execute(sql`
      UPDATE ${leaderboardTable} t
      SET score = t.score + COALESCE(ut.total_score, 0)
      FROM first_items fi
      LEFT JOIN user_totals ut ON ut.user_id = fi.user_id AND ut.chat_id = fi.chat_id
      WHERE t.id = fi.id;
    `);

  // Step 5: Delete old entries based on user_id and chat_id
  await trx.execute(sql`
      DELETE FROM ${leaderboardTable}
      WHERE created_at < DATE_TRUNC('year', CURRENT_DATE)
      AND id NOT IN (SELECT id FROM first_items);
    `);

  // Clean up temporary tables
  await trx.execute(sql`
      DROP TABLE first_items;
      DROP TABLE user_totals;
    `);
});

console.log(
  "Leaderboard table updated for all users and chat_ids successfully.",
);

console.log("Leaderboard table updated for all users successfully.");
