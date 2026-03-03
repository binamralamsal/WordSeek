import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chat_game_topics")
    .addColumn("allowed_lengths", sql`integer[]`, (col) =>
      col.defaultTo(sql`ARRAY[5,4,6]`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("chat_game_topics")
    .dropColumn("allowed_lengths")
    .execute();
}
