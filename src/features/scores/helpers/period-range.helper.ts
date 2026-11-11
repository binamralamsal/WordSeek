import { type RawBuilder, sql } from "kysely";

import type { LeaderboardPeriod } from "#/types";

const TRUNC_UNITS = {
  today: "day",
  week: "week",
  month: "month",
  year: "year",
} as const satisfies Record<Exclude<LeaderboardPeriod, "all">, string>;

export interface PeriodRange {
  from: RawBuilder<Date>;
  to: RawBuilder<Date>;
}

/**
 * Half-open `[from, to)` range for a leaderboard period.
 *
 * The original queries compared `date_trunc(unit, created_at)` with
 * `date_trunc(unit, now())`. Wrapping the column in a function prevents
 * Postgres from using a plain index on `created_at`. Comparing the column to
 * the same boundaries instead keeps the column bare, so the indexes added in
 * `1772600000000_leaderboard_indexes` can serve the filter as a range scan.
 */
export function getPeriodRange(timeKey: LeaderboardPeriod): PeriodRange | null {
  if (timeKey === "all") return null;

  const unit = TRUNC_UNITS[timeKey];

  return {
    from: sql<Date>`date_trunc(${unit}, now())`,
    to: sql<Date>`date_trunc(${unit}, now()) + (${`1 ${unit}`})::interval`,
  };
}
