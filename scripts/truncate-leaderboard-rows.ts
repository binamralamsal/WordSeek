import { sql } from "kysely";

import { db } from "../src/config/db";

const leaderboard = sql.table("leaderboard");

await db.transaction().execute(async (trx) => {
  // Step 1: Create temporary table for first items per user and chat_id
  await sql`
      CREATE TEMPORARY TABLE first_items AS
      SELECT DISTINCT ON (user_id, chat_id) id, user_id, chat_id, score, created_at
      FROM ${leaderboard}
      WHERE created_at < DATE_TRUNC('year', CURRENT_DATE)
      ORDER BY user_id, chat_id, created_at;
    `.execute(trx);

  // Step 2: Create temporary table for total scores per user and chat_id
  await sql`
      CREATE TEMPORARY TABLE user_totals AS
      SELECT user_id, chat_id, SUM(score) AS total_score
      FROM ${leaderboard}
      WHERE created_at < DATE_TRUNC('year', CURRENT_DATE)
      AND id NOT IN (SELECT id FROM first_items)
      GROUP BY user_id, chat_id;
    `.execute(trx);

  // Step 3: Create index for better join performance
  await sql`
      CREATE INDEX ON user_totals(user_id, chat_id);
    `.execute(trx);

  // Step 4: Update scores using a direct join based on user_id and chat_id
  await sql`
      UPDATE ${leaderboard} t
      SET score = t.score + COALESCE(ut.total_score, 0)
      FROM first_items fi
      LEFT JOIN user_totals ut ON ut.user_id = fi.user_id AND ut.chat_id = fi.chat_id
      WHERE t.id = fi.id;
    `.execute(trx);

  // Step 5: Delete old entries based on user_id and chat_id
  await sql`
      DELETE FROM ${leaderboard}
      WHERE created_at < DATE_TRUNC('year', CURRENT_DATE)
      AND id NOT IN (SELECT id FROM first_items);
    `.execute(trx);

  // Clean up temporary tables
  await sql`DROP TABLE first_items;`.execute(trx);
  await sql`DROP TABLE user_totals;`.execute(trx);
});

console.log(
  "Leaderboard table updated for all users and chat_ids successfully.",
);
