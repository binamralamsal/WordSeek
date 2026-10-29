import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";
import { LEADERBOARD_PERIODS, LEADERBOARD_SCOPES, WORD_LENGTHS } from "#/types";

export type ParsedLeaderboardInput = {
  searchKey: LeaderboardScope | undefined;
  timeKey: LeaderboardPeriod | undefined;
  wordLength: WordLength;
  target: string | undefined;
};

export function parseLeaderboardInput(
  input: string,
  defaultSearchKey?: LeaderboardScope,
  defaultTimeKey?: LeaderboardPeriod | null,
  defaultWordLength: WordLength = 5,
): ParsedLeaderboardInput {
  const parts = input.toLowerCase().trim().split(/\s+/).filter(Boolean);

  let target: string | undefined;
  let foundSearchKey: LeaderboardScope | undefined;
  let foundTimeKey: LeaderboardPeriod | undefined;
  let foundWordLength: WordLength | undefined;

  for (const part of parts) {
    if ((LEADERBOARD_SCOPES as readonly string[]).includes(part)) {
      foundSearchKey = part as LeaderboardScope;
      continue;
    }

    if ((LEADERBOARD_PERIODS as readonly string[]).includes(part)) {
      foundTimeKey = part as LeaderboardPeriod;
      continue;
    }

    if ((WORD_LENGTHS as readonly number[]).includes(Number(part))) {
      foundWordLength = Number(part) as WordLength;
      continue;
    }

    if (part.startsWith("@") || /^\d+$/.test(part)) {
      target = part;
      continue;
    }

    if (!target && parts.indexOf(part) === 0) {
      target = part;
    }
  }

  const searchKey = foundSearchKey || defaultSearchKey;
  const timeKey =
    foundTimeKey || (defaultTimeKey === null ? undefined : defaultTimeKey);
  const wordLength = foundWordLength ?? defaultWordLength;

  return { searchKey, timeKey, wordLength, target };
}

export function parseLeaderboardFilters(
  input: string,
  defaultSearchKey: LeaderboardScope = "group",
  defaultTimeKey: LeaderboardPeriod = "month",
) {
  const parts = input.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const searchKey = (parts.find((part) =>
    (LEADERBOARD_SCOPES as readonly string[]).includes(part),
  ) || defaultSearchKey) as LeaderboardScope;

  const timeKey = (parts.find((part) =>
    (LEADERBOARD_PERIODS as readonly string[]).includes(part),
  ) || defaultTimeKey) as LeaderboardPeriod;

  const wordLengthPart = parts.find((part) =>
    (WORD_LENGTHS as readonly number[]).includes(Number(part)),
  );
  const wordLength: WordLength = wordLengthPart
    ? (Number(wordLengthPart) as WordLength)
    : 5;

  return { searchKey, timeKey, wordLength };
}
