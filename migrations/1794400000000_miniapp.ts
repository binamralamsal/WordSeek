import { type Kysely, sql } from "kysely";

/**
 * Mini App identity plus shared game history. Mini App classic games use the
 * existing games/guesses tables and a separate source/scope, so they never
 * collide with Telegram chat games and can keep one active length per player.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("nickname", "text")
    .addColumn("photo_url", "text")
    .execute();

  await db.schema
    .alterTable("games")
    .addColumn("source", "varchar(16)", (col) =>
      col.notNull().defaultTo("telegram"),
    )
    .addColumn("game_status", "varchar(10)", (col) =>
      col.notNull().defaultTo("active"),
    )
    .addColumn("attempts_used", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("score", "integer")
    .addColumn("finished_at", "timestamptz")
    .execute();

  await sql`
    ALTER TABLE games
    ADD CONSTRAINT games_source_check CHECK (source IN ('telegram', 'miniapp'));
  `.execute(db);
  await sql`
    ALTER TABLE games
    ADD CONSTRAINT games_status_check
    CHECK (game_status IN ('active', 'won', 'lost'));
  `.execute(db);

  await sql`
    ALTER TABLE games
    DROP CONSTRAINT IF EXISTS games_active_chat_topic_id_unique;
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX games_active_source_scope_idx
    ON games (source, active_chat, topic_id)
    WHERE game_status = 'active';
  `.execute(db);
  await sql`
    CREATE INDEX games_miniapp_finished_idx
    ON games (active_chat, topic_id, updated_at)
    WHERE source = 'miniapp';
  `.execute(db);

  await db.schema
    .alterTable("guesses")
    .addColumn("user_id", "text", (col) => col.references("users.id"))
    .addColumn("attempt_number", "integer")
    .execute();
  await db.schema
    .createIndex("guesses_user_game_idx")
    .on("guesses")
    .columns(["user_id", "game_id"])
    .execute();

  await db.schema
    .alterTable("user_stats")
    .addColumn("classic_games_played", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("classic_games_won", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("classic_games_lost", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("classic_total_score", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("daily_games_played", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("daily_games_won", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("daily_games_lost", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();

  // Compaction combines old score rows. A score of at most 30 is one known
  // win; larger rows are estimated at the historical average of 20 points.
  // The estimate is stored once so future reads do not guess repeatedly.
  await sql`
    INSERT INTO user_stats (user_id, highest_streak, current_streak)
    SELECT DISTINCT user_id, 0, 0 FROM leaderboard
    ON CONFLICT (user_id) DO NOTHING;
  `.execute(db);
  await sql`
    WITH score_counts AS (
      SELECT user_id,
        SUM(CASE WHEN score <= 30 THEN 1 ELSE GREATEST(1, ROUND(score::numeric / 20)) END)::integer AS wins,
        SUM(score)::integer AS total_score
      FROM leaderboard GROUP BY user_id
    )
    UPDATE user_stats AS stats SET
      classic_games_played = score_counts.wins,
      classic_games_won = score_counts.wins,
      classic_total_score = score_counts.total_score
    FROM score_counts WHERE stats.user_id = score_counts.user_id;
  `.execute(db);

  await sql`
    INSERT INTO user_stats (user_id, highest_streak, current_streak)
    SELECT DISTINCT user_id, 0, 0 FROM daily_guesses
    ON CONFLICT (user_id) DO NOTHING;
  `.execute(db);
  await sql`
    WITH daily_results AS (
      SELECT guesses.user_id, guesses.daily_word_id,
        bool_or(guesses.guess = words.word) AS won,
        COUNT(*) >= 6 AS exhausted
      FROM daily_guesses AS guesses
      JOIN daily_words AS words ON words.id = guesses.daily_word_id
      GROUP BY guesses.user_id, guesses.daily_word_id
    ), daily_counts AS (
      SELECT user_id,
        COUNT(*) FILTER (WHERE won OR exhausted)::integer AS played,
        COUNT(*) FILTER (WHERE won)::integer AS wins,
        COUNT(*) FILTER (WHERE NOT won AND exhausted)::integer AS losses
      FROM daily_results GROUP BY user_id
    )
    UPDATE user_stats AS stats SET
      daily_games_played = daily_counts.played,
      daily_games_won = daily_counts.wins,
      daily_games_lost = daily_counts.losses
    FROM daily_counts WHERE stats.user_id = daily_counts.user_id;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS guesses_user_game_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS games_miniapp_finished_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS games_active_source_scope_idx`.execute(db);
  await sql`DELETE FROM games WHERE source = 'miniapp'`.execute(db);
  await sql`
    ALTER TABLE games
    ADD CONSTRAINT games_active_chat_topic_id_unique UNIQUE (active_chat, topic_id);
  `.execute(db);
  await db.schema
    .alterTable("guesses")
    .dropColumn("attempt_number")
    .dropColumn("user_id")
    .execute();
  await db.schema
    .alterTable("user_stats")
    .dropColumn("daily_games_lost")
    .dropColumn("daily_games_won")
    .dropColumn("daily_games_played")
    .dropColumn("classic_total_score")
    .dropColumn("classic_games_lost")
    .dropColumn("classic_games_won")
    .dropColumn("classic_games_played")
    .execute();
  await db.schema
    .alterTable("games")
    .dropColumn("finished_at")
    .dropColumn("score")
    .dropColumn("attempts_used")
    .dropColumn("game_status")
    .dropColumn("source")
    .execute();
  await db.schema
    .alterTable("users")
    .dropColumn("photo_url")
    .dropColumn("nickname")
    .execute();
}
