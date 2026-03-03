import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TYPE word_length AS ENUM ('4', '5', '6');
  `.execute(db);

  await db.schema
    .alterTable("leaderboard")
    .addColumn("word_length", sql`word_length`, (col) =>
      col.notNull().defaultTo(sql`'5'::word_length`),
    )
    .execute();

  await db.schema
    .alterTable("games")
    .addColumn("topic_id", "text", (col) => col.notNull().defaultTo("general"))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("games").dropColumn("topic_id").execute();

  await db.schema.alterTable("leaderboard").dropColumn("word_length").execute();

  await sql`
    DROP TYPE IF EXISTS word_length;
  `.execute(db);
}
