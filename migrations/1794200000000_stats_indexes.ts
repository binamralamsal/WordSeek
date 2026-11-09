import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // /stats counts distinct chat IDs across the whole leaderboard. The
  // existing leaderboard indexes lead with word_length, so Postgres cannot
  // use them for this scan. A dedicated chat_id index keeps it index-only.
  await db.schema
    .createIndex("leaderboard_chat_id_idx")
    .on("leaderboard")
    .columns(["chat_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("leaderboard_chat_id_idx").ifExists().execute();
}
