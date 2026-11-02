import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  WordLength,
} from "#/types";

import { getLeaderboardScores } from "./get-leaderboard-scores.service";
import { getUserScores } from "./get-user-scores.service";

export type LeaderboardCurrentUser = LeaderboardEntry & { rank: number };

export async function getLeaderboardView({
  chatId,
  requesterId,
  searchKey,
  timeKey,
  wordLength,
}: {
  chatId: string;
  requesterId?: string;
  searchKey: LeaderboardScope;
  timeKey: LeaderboardPeriod;
  wordLength: WordLength;
}) {
  const entries = await getLeaderboardScores({
    chatId,
    searchKey,
    timeKey,
    wordLength,
  });

  // The leaderboard only returns the top 20. If the requester is not in that
  // list, fetch their rank separately so they can still see where they stand.
  if (!requesterId || entries.some((entry) => entry.userId === requesterId)) {
    return { entries, currentUser: undefined };
  }

  const user = await getUserScores({
    chatId,
    searchKey,
    timeKey,
    userId: requesterId,
    wordLength,
  });

  if (!user) return { entries, currentUser: undefined };

  return {
    entries,
    currentUser: {
      userId: user.id,
      name: user.name,
      username: user.username,
      totalScore: Number(user.totalScore),
      rank: Number(user.rank),
    } satisfies LeaderboardCurrentUser,
  };
}
