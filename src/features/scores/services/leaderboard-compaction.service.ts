import { sql } from "kysely";

import { getDatabase } from "#/config/db";
import { createLogger } from "#/core/logging/logger.service";

const log = createLogger(
  "features.scores.services.leaderboard-compaction.service",
);

// Arbitrary key that only this compaction uses. The transaction-scoped
// advisory lock makes overlapping runs (cron + manual script) a no-op instead
// of a write conflict.
const COMPACTION_LOCK_ID = 711_202_501;

export interface CompactionResult {
  /** Buckets that had more than one row and were collapsed. */
  bucketsCompacted: number;
  /** Rows deleted after their score was folded into the keeper row. */
  rowsRemoved: number;
  /** Rows left in the leaderboard. */
  remainingRows: number;
}

export interface CompactionOptions {
  /** Reference time for the period boundaries. Defaults to `new Date()`. */
  now?: Date;
}

/**
 * Collapse leaderboard rows that every leaderboard filter treats identically.
 *
 * The filters are today, this week, this month, this year and all time. Two
 * rows can only be merged when they are included in exactly the same set of
 * filters. Because week boundaries can cross month/year boundaries, grouping
 * by "before this year"/"before this month" alone is wrong: a score from
 * 31 December can still belong to this week but not to this year or month.
 *
 * The implementation therefore partitions rows by `max(boundary)` of
 * `[week, month, year]` starts that are `<= created_at`, among rows older than
 * today. Every row in a partition has the same filter membership, so the
 * partition can safely be summed into its earliest row:
 *
 * - rows before this year     -> all time only
 * - before this month in year -> year + all time
 * - before this week in month -> month + year + all time
 * - before today in week      -> week + month + year + all time
 *
 * Today's rows are deliberately left untouched: every filter includes them,
 * they are few, and keeping their real timestamps preserves the "latest play"
 * heuristic used by `/score`'s smart defaults. (It also means future-dated
 * rows from an import are never folded into today.)
 *
 * The keeper keeps its original `created_at` (the earliest row of the
 * partition), which is what keeps the timestamps inside the same filter
 * buckets. Boundaries only move forward and always jump past a whole
 * partition, so an already-merged row never has to be split again.
 */
export async function compactLeaderboard(
  options: CompactionOptions = {},
): Promise<CompactionResult | null> {
  const now = options.now ?? new Date();

  return await getDatabase()
    .transaction()
    .execute(async (trx) => {
      const lock = await sql<{ locked: boolean }>`
        SELECT pg_try_advisory_xact_lock(${COMPACTION_LOCK_ID}) AS locked
      `.execute(trx);

      if (!lock.rows[0]?.locked) {
        log.warn("Skipping leaderboard compaction: another run holds the lock");
        return null;
      }

      await sql`
        CREATE TEMPORARY TABLE leaderboard_compaction_plan ON COMMIT DROP AS
        WITH boundaries AS (
          SELECT
            date_trunc('day', ${now}::timestamptz) AS day_start,
            date_trunc('week', ${now}::timestamptz) AS week_start,
            date_trunc('month', ${now}::timestamptz) AS month_start,
            date_trunc('year', ${now}::timestamptz) AS year_start
        ),
        segmented AS (
          SELECT
            leaderboard.id,
            leaderboard.user_id,
            leaderboard.chat_id,
            leaderboard.word_length,
            leaderboard.score,
            leaderboard.created_at,
            GREATEST(
              CASE
                WHEN leaderboard.created_at >= boundaries.day_start
                THEN boundaries.day_start
              END,
              CASE
                WHEN leaderboard.created_at >= boundaries.week_start
                THEN boundaries.week_start
              END,
              CASE
                WHEN leaderboard.created_at >= boundaries.month_start
                THEN boundaries.month_start
              END,
              CASE
                WHEN leaderboard.created_at >= boundaries.year_start
                THEN boundaries.year_start
              END
            ) AS segment_start
          FROM leaderboard
          CROSS JOIN boundaries
          WHERE leaderboard.created_at < boundaries.day_start
        ),
        ranked AS (
          SELECT
            id,
            row_number() OVER (
              PARTITION BY segment_start, user_id, chat_id, word_length
              ORDER BY created_at, id
            ) AS position,
            count(*) OVER (
              PARTITION BY segment_start, user_id, chat_id, word_length
            ) AS bucket_size,
            sum(score) OVER (
              PARTITION BY segment_start, user_id, chat_id, word_length
            ) AS bucket_total
          FROM segmented
        )
        SELECT id, bucket_total, position = 1 AS is_keeper
        FROM ranked
        WHERE bucket_size > 1
      `.execute(trx);

      const updated = await sql`
        UPDATE leaderboard AS current
        SET score = plan.bucket_total::integer
        FROM leaderboard_compaction_plan AS plan
        WHERE current.id = plan.id AND plan.is_keeper
      `.execute(trx);

      const deleted = await sql`
        DELETE FROM leaderboard AS current
        USING leaderboard_compaction_plan AS plan
        WHERE current.id = plan.id AND NOT plan.is_keeper
      `.execute(trx);

      const remaining = await sql<{ remaining: number }>`
        SELECT count(*)::integer AS remaining FROM leaderboard
      `.execute(trx);

      return {
        bucketsCompacted: Number(updated.numAffectedRows ?? 0n),
        rowsRemoved: Number(deleted.numAffectedRows ?? 0n),
        remainingRows: remaining.rows[0]?.remaining ?? 0,
      };
    });
}
