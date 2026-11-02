import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  WordLength,
} from "#/types";

import { getLeaderboardScores } from "./get-leaderboard-scores.service";
import { getUserScores } from "./get-user-scores.service";

export type LeaderboardCurrentUser = LeaderboardEntry & {
  rank: number | null;
};

type Requester = {
  id: string;
  name: string;
  username: string | null;
};

export async function getLeaderboardView({
  adminIds,
  chatId,
  requester,
  searchKey,
  timeKey,
  wordLength,
}: {
  adminIds: ReadonlySet<string>;
  chatId: string;
  requester?: Requester;
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
  if (!requester || entries.some((entry) => entry.userId === requester.id)) {
    return { entries, currentUser: undefined };
  }

  const user = await getUserScores({
    chatId,
    searchKey,
    timeKey,
    userId: requester.id,
    wordLength,
  });

  if (user) {
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

  // Admins should still be identifiable even before they score in a filter.
  if (!adminIds.has(requester.id)) {
    return { entries, currentUser: undefined };
  }

  return {
    entries,
    currentUser: {
      userId: requester.id,
      name: requester.name,
      username: requester.username,
      totalScore: 0,
      rank: null,
    } satisfies LeaderboardCurrentUser,
  };
}
