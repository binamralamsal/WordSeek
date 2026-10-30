import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

export function formatScopeLabel(scope: LeaderboardScope): string {
  return scope === "global" ? "Global" : "Group";
}

export function formatScopeSentence(scope: LeaderboardScope): string {
  return scope === "global" ? "globally" : "in this chat";
}

/** Short, consistently formatted summary shown under score/leaderboard titles. */
export function formatFilterSummary(
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength,
): string {
  return `${formatScopeLabel(searchKey)} · ${PERIOD_LABELS[timeKey]} · ${wordLength} letters`;
}

export function formatPeriodLabel(timeKey: LeaderboardPeriod): string {
  return PERIOD_LABELS[timeKey];
}
