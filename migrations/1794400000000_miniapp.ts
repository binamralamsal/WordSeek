import { type Kysely, sql } from "kysely";

/**
 * Telegram Mini App support.
 *
 * - `users.nickname` is the public WordSeek name. Telegram account data in
 *   `name`/`username` is never modified.
 * - `users.photo_url` caches the Telegram profile photo URL supplied by the
 *   Web App `initData` payload so leaderboards can show avatars.
 * - Classic Mini App games are kept separately from the chat-scoped `games`
 *   table because they belong to a single player and can run for 30 guesses.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("nickname", "text")
    .addColumn("photo_url", "text")
    .execute();

  await db.schema
    .createTable("mini_app_games")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("word", "varchar(6)", (col) => col.notNull())
    .addColumn("word_length", sql`word_length`, (col) => col.notNull())
    .addColumn("chat_id", "text", (col) => col.notNull())
    .addColumn("status", "varchar(10)", (col) =>
      col.notNull().defaultTo("active"),
    )
    .addColumn("attempts_used", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("score", "integer")
    .addColumn("started_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("finished_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await sql`
    ALTER TABLE mini_app_games
    ADD CONSTRAINT mini_app_games_status_check
    CHECK (status IN ('active', 'won', 'lost'));
  `.execute(db);

  await sql`
    CREATE TRIGGER update_mini_app_games_updated_at
    BEFORE UPDATE ON mini_app_games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  // A player can only have one unfinished classic game. The API returns the
  // active game instead of starting a second one, so the partial index is
  // mostly a guard against concurrent requests.
  await sql`
    CREATE UNIQUE INDEX mini_app_games_one_active_per_user_idx
    ON mini_app_games (user_id)
    WHERE status = 'active';
  `.execute(db);

  // Profile summaries scan one player's finished games; leaderboard-adjacent
  // screens scan their recent games.
  await db.schema
    .createIndex("mini_app_games_user_status_created_at_idx")
    .on("mini_app_games")
    .columns(["user_id", "status", "created_at"])
    .execute();

  await db.schema
    .createTable("mini_app_guesses")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().generatedByDefaultAsIdentity(),
    )
    .addColumn("game_id", "integer", (col) =>
      col.notNull().references("mini_app_games.id").onDelete("cascade"),
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
    CREATE TRIGGER update_mini_app_guesses_updated_at
    BEFORE UPDATE ON mini_app_guesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `.execute(db);

  await db.schema
    .createIndex("mini_app_guesses_game_attempt_idx")
    .on("mini_app_guesses")
    .columns(["game_id", "attempt_number"])
    .unique()
    .execute();

  await db.schema
    .createIndex("mini_app_guesses_game_guess_idx")
    .on("mini_app_guesses")
    .columns(["game_id", "guess"])
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("mini_app_guesses").ifExists().execute();
  await db.schema.dropTable("mini_app_games").ifExists().execute();
  await db.schema
    .alterTable("users")
    .dropColumn("photo_url")
    .dropColumn("nickname")
    .execute();
}
