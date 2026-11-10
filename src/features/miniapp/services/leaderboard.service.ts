import { sql } from "kysely";

import { db } from "#/config/db";
import type {
  LeaderboardPage,
  LeaderboardRow,
  MiniAppLeaderboardScope,
  MyRanking,
} from "#/shared/miniapp";
import {
  type LeaderboardPeriod,
  toDbWordLength,
  type WordLength,
} from "#/types";

import { getPeriodRange } from "../../scores/helpers/period-range.helper";

export const LEADERBOARD_PAGE_SIZE = 10;
export const LEADERBOARD_MAX_PAGE_SIZE = 50;

type LeaderboardQueryInput = {
  scope: MiniAppLeaderboardScope;
  period: LeaderboardPeriod;
  wordLength: WordLength;
  chatId?: string | null;
  page: number;
  pageSize?: number;
};

function buildTotalsQuery({
  scope,
  period,
  wordLength,
  chatId,
}: Omit<LeaderboardQueryInput, "page" | "pageSize">) {
  let query = db
    .selectFrom("leaderboard")
    .select("leaderboard.userId")
    .select(sql<number>`cast(sum(score) as integer)`.as("totalScore"))
    .select(sql<number>`cast(max(least(score, 30)) as integer)`.as("bestScore"))
    .select(
      sql<number>`cast(rank() over (order by sum(score) desc) as integer)`.as(
        "rank",
      ),
    )
    .where("leaderboard.wordLength", "=", toDbWordLength(wordLength))
    .where(
      "leaderboard.userId",
      "not in",
      db.selectFrom("bannedUsers").select("userId"),
    )
    .groupBy("leaderboard.userId");

  if (scope === "group" || scope === "private") {
    query = query.where("leaderboard.chatId", "=", chatId ?? "");
  }

  const range = getPeriodRange(period);

  if (range) {
    query = query
      .where("leaderboard.createdAt", ">=", range.from)
      .where("leaderboard.createdAt", "<", range.to);
  }

  return query;
}

function normalizePageSize(pageSize: number | undefined): number {
  if (!Number.isFinite(pageSize)) return LEADERBOARD_PAGE_SIZE;
  return Math.min(
    LEADERBOARD_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(pageSize!)),
  );
}

export async function getLeaderboardPage(
  input: LeaderboardQueryInput,
): Promise<LeaderboardPage> {
  const page = Number.isFinite(input.page)
    ? Math.max(1, Math.floor(input.page))
    : 1;
  const pageSize = normalizePageSize(input.pageSize);
  const totals = buildTotalsQuery(input);

  const [rows, countRow] = await Promise.all([
    db
      .selectFrom(totals.as("totals"))
      .innerJoin("users", "users.id", "totals.userId")
      .select([
        "totals.rank",
        "totals.userId",
        "totals.totalScore",
        "totals.bestScore",
        "users.name",
        "users.nickname",
        "users.username",
        "users.photoUrl",
      ])
      .orderBy("totals.rank", "asc")
      .orderBy("totals.userId", "asc")
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute(),
    db
      .selectFrom(totals.as("totals"))
      .select(sql<number>`cast(count(*) as integer)`.as("total"))
      .executeTakeFirst(),
  ]);

  const total = Number(countRow?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const mapped: LeaderboardRow[] = rows.map((row) => ({
    rank: Number(row.rank),
    userId: row.userId,
    displayName: row.nickname?.trim() || row.name,
    username: row.username,
    photoUrl: row.photoUrl,
    score: Number(row.totalScore),
    isMe: false,
  }));

  return {
    rows: mapped,
    page: Math.min(page, totalPages),
    pageSize,
    total,
    totalPages,
    totalPlayers: total,
    scope: input.scope,
    period: input.period,
    wordLength: input.wordLength,
  };
}

export async function getMyRanking(
  input: Omit<LeaderboardQueryInput, "page" | "pageSize"> & {
    userId: string;
  },
): Promise<MyRanking> {
  const totals = buildTotalsQuery(input);

  const [row, countRow] = await Promise.all([
    db
      .selectFrom(totals.as("totals"))
      .select(["totals.rank", "totals.totalScore", "totals.bestScore"])
      .where("totals.userId", "=", input.userId)
      .executeTakeFirst(),
    db
      .selectFrom(totals.as("totals"))
      .select(sql<number>`cast(count(*) as integer)`.as("total"))
      .executeTakeFirst(),
  ]);

  if (!row) return null;

  return {
    rank: Number(row.rank),
    score: Number(row.totalScore),
    bestScore: Number(row.bestScore),
    totalPlayers: Number(countRow?.total ?? 0),
    scope: input.scope,
    period: input.period,
    wordLength: input.wordLength,
  };
}
