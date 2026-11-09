import { type Kysely, sql } from "kysely";

/** Mini App identity, shared game storage and profile counters. */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("nickname", "text")
    .addColumn("photo_url", "text")
    .execute();

  await sql`
    CREATE TYPE game_source AS ENUM ('telegram', 'miniapp');
  `.execute(db);

  await db.schema
    .alterTable("games")
    .addColumn("source", sql`game_source`, (col) =>
      col.notNull().defaultTo(sql`'telegram'::game_source`),
    )
    .addColumn("game_status", "varchar(10)", (col) =>
      col.notNull().defaultTo("active"),
    )
    .execute();

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
    CREATE INDEX games_miniapp_scope_updated_idx
    ON games (active_chat, topic_id, updated_at)
    WHERE source = 'miniapp';
  `.execute(db);

  await db.schema
    .alterTable("user_stats")
    .addColumn("classic_games_won", "integer", (col) =>
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

  // Old score compaction sums several wins into rows over 30 points. Estimate
  // each such row at 20 points per win and persist the resulting win baseline.
  await sql`
    INSERT INTO user_stats (user_id, highest_streak, current_streak)
    SELECT DISTINCT user_id, 0, 0 FROM leaderboard
    ON CONFLICT (user_id) DO NOTHING;
  `.execute(db);
  await sql`
    WITH score_counts AS (
      SELECT user_id,
        SUM(CASE WHEN score <= 30 THEN 1
          ELSE GREATEST(1, ROUND(score::numeric / 20))
        END)::integer AS wins
      FROM leaderboard
      GROUP BY user_id
    )
    UPDATE user_stats AS stats
    SET classic_games_won = score_counts.wins
    FROM score_counts
    WHERE stats.user_id = score_counts.user_id;
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
      FROM daily_results
      GROUP BY user_id
    )
    UPDATE user_stats AS stats SET
      daily_games_played = daily_counts.played,
      daily_games_won = daily_counts.wins,
      daily_games_lost = daily_counts.losses
    FROM daily_counts
    WHERE stats.user_id = daily_counts.user_id;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS games_miniapp_scope_updated_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS games_active_source_scope_idx`.execute(db);
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'games'
          AND column_name = 'source'
      ) THEN
        DELETE FROM games WHERE source = 'miniapp';
      END IF;
    END $$;
  `.execute(db);
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'games_active_chat_topic_id_unique'
      ) THEN
        ALTER TABLE games
        ADD CONSTRAINT games_active_chat_topic_id_unique
        UNIQUE (active_chat, topic_id);
      END IF;
    END $$;
  `.execute(db);

  await sql`
    ALTER TABLE user_stats
      DROP COLUMN IF EXISTS daily_games_lost,
      DROP COLUMN IF EXISTS daily_games_won,
      DROP COLUMN IF EXISTS daily_games_played,
      DROP COLUMN IF EXISTS classic_games_won;
  `.execute(db);
  await sql`
    ALTER TABLE games
      DROP CONSTRAINT IF EXISTS games_status_check,
      DROP COLUMN IF EXISTS game_status,
      DROP COLUMN IF EXISTS source;
  `.execute(db);
  await sql`DROP TYPE IF EXISTS game_source`.execute(db);
  await sql`
    ALTER TABLE users
      DROP COLUMN IF EXISTS photo_url,
      DROP COLUMN IF EXISTS nickname;
  `.execute(db);
}
