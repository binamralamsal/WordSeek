export const LEADERBOARD_SCOPES = ["global", "group"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

export const LEADERBOARD_PERIODS = [
  "today",
  "week",
  "month",
  "year",
  "all",
] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const WORD_LENGTHS = [4, 5, 6] as const;
export type WordLength = (typeof WORD_LENGTHS)[number];

export type DbWordLength = `${WordLength}`;

export const LEADERBOARD_PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

export function toDbWordLength(length: WordLength): DbWordLength {
  return String(length) as DbWordLength;
}

export function isLeaderboardScope(value: string): value is LeaderboardScope {
  return (LEADERBOARD_SCOPES as readonly string[]).includes(value);
}

export function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value);
}

export function isWordLength(value: number): value is WordLength {
  return (WORD_LENGTHS as readonly number[]).includes(value);
}

export type LeaderboardEntry = {
  userId: string;
  name: string;
  nickname?: string | null;
  username: string | null;
  photoUrl?: string | null;
  totalScore: number;
};
