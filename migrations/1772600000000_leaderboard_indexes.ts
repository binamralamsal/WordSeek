import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Group leaderboard (and group rank): filter by word length and chat, then
  // range-scan created_at. `user_id` and `score` are trailing so Postgres can
  // answer the aggregation from the index alone on a vacuumed table.
  await db.schema
    .createIndex("leaderboard_word_length_chat_id_created_at_idx")
    .on("leaderboard")
    .columns(["word_length", "chat_id", "created_at", "user_id", "score"])
    .execute();

  // Global leaderboard (and global rank): same idea without the chat filter.
  await db.schema
    .createIndex("leaderboard_word_length_created_at_idx")
    .on("leaderboard")
    .columns(["word_length", "created_at", "user_id", "score"])
    .execute();

  // Smart defaults for /score: find the lengths a user has played (and their
  // latest entry) in a single user.
  await db.schema
    .createIndex("leaderboard_user_id_word_length_chat_id_created_at_idx")
    .on("leaderboard")
    .columns(["user_id", "word_length", "chat_id", "created_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .dropIndex("leaderboard_user_id_word_length_chat_id_created_at_idx")
    .ifExists()
    .execute();

  await db.schema
    .dropIndex("leaderboard_word_length_created_at_idx")
    .ifExists()
    .execute();

  await db.schema
    .dropIndex("leaderboard_word_length_chat_id_created_at_idx")
    .ifExists()
    .execute();
}
