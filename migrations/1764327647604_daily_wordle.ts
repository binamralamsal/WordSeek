import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user_stats")
    .addColumn("user_id", "text", (col) =>
      col.primaryKey().references("users.id").onDelete("cascade"),
    )
    .addColumn("highest_streak", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("current_streak", "integer", (col) => col.defaultTo(0).notNull())
    .addColumn("last_guessed", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`
    CREATE TRIGGER update_user_stats_updated_at
    BEFORE UPDATE ON user_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db.schema
    .createTable("daily_words")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("day_number", "integer", (col) =>
      col.notNull().unique().generatedByDefaultAsIdentity(),
    )
    .addColumn("word", "varchar(6)", (col) => col.notNull())
    .addColumn("date", "date", (col) => col.notNull().unique())
    .addColumn("meaning", "text")
    .addColumn("phonetic", "text")
    .addColumn("sentence", "text")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`
    CREATE TRIGGER update_daily_words_updated_at
    BEFORE UPDATE ON daily_words
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db.schema
    .createTable("daily_guesses")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("daily_word_id", "integer", (col) =>
      col.notNull().references("daily_words.id").onDelete("cascade"),
    )
    .addColumn("guess", "varchar(6)", (col) => col.notNull())
    .addColumn("attempt_number", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`
    CREATE TRIGGER update_daily_guesses_updated_at
    BEFORE UPDATE ON daily_guesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db.schema
    .createIndex("daily_guesses_user_daily_word_idx")
    .on("daily_guesses")
    .columns(["user_id", "daily_word_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("daily_guesses").ifExists().execute();
  await db.schema.dropTable("daily_words").ifExists().execute();
  await db.schema.dropTable("user_stats").ifExists().execute();
}
