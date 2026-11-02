import { isLeaderboardPeriod, isLeaderboardScope } from "#/types";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

export type LeaderboardFilter = {
  searchKey: LeaderboardScope;
  timeKey: LeaderboardPeriod;
  wordLength: WordLength;
};

const LEADERBOARD_DATA_PARTS = 4;

function parseWordLength(value: string | undefined): WordLength | null {
  if (!value) return null;

  const parsed = parseInt(value);

  return parsed === 4 || parsed === 5 || parsed === 6 ? parsed : null;
}

export function parseLeaderboardCallback(
  data: string,
): LeaderboardFilter | null {
  const parts = data.split(" ");

  if (parts.length !== LEADERBOARD_DATA_PARTS) return null;

  const [, searchKey, timeKey, wordLength] = parts;

  if (!searchKey || !isLeaderboardScope(searchKey)) return null;
  if (!timeKey || !isLeaderboardPeriod(timeKey)) return null;

  const parsedLength = parseWordLength(wordLength);
  if (!parsedLength) return null;

  return { searchKey, timeKey, wordLength: parsedLength };
}

export function parseScoreListCallback(data: string): string | null {
  const [, username] = data.split(" ");

  return username || null;
}

export function parseScoreSelectCallback(
  data: string,
): { userId: string; username: string | undefined } | null {
  const [, userId, username] = data.split(" ");

  if (!userId) return null;

  return { userId, username };
}

export function parseScoreCallback(
  data: string,
): (LeaderboardFilter & { userId: string }) | null {
  const [, userId, searchKey, timeKey, wordLength] = data.split(" ");

  if (!userId) return null;
  if (!searchKey || !isLeaderboardScope(searchKey)) return null;
  if (!timeKey || !isLeaderboardPeriod(timeKey)) return null;

  const parsedLength = parseWordLength(wordLength);
  if (!parsedLength) return null;

  return {
    userId,
    searchKey,
    timeKey,
    wordLength: parsedLength,
  };
}
