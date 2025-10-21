import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("chat_game_topics")
    .addColumn("chat_id", "text", (col) => col.notNull())
    .addColumn("topic_id", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addPrimaryKeyConstraint("chat_game_topics_pkey", ["chat_id", "topic_id"])
    .execute();

  await sql`
    CREATE TRIGGER update_chat_game_topics_updated_at
    BEFORE UPDATE ON chat_game_topics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("chat_game_topics").ifExists().execute();
}
