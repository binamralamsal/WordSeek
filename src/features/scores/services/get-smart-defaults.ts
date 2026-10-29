import { db } from "#/config/db";
import { toDbWordLength } from "#/types";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

export async function getSmartDefaults({
  userId,
  chatId,
  requestedSearchKey,
  requestedTimeKey,
  requestedWordLength,
  chatType,
}: {
  userId: string;
  chatId: string;
  requestedSearchKey?: LeaderboardScope;
  requestedTimeKey?: LeaderboardPeriod;
  requestedWordLength?: WordLength;
  chatType: string;
}) {
  let searchKey: LeaderboardScope =
    requestedSearchKey || (chatType === "private" ? "global" : "group");

  if (searchKey === "group" && chatType !== "private") {
    const groupScoresExist = await db
      .selectFrom("leaderboard")
      .select("userId")
      .where("userId", "=", userId)
      .where("chatId", "=", chatId)
      .limit(1)
      .executeTakeFirst();

    if (!groupScoresExist) {
      searchKey = "global";
    }
  }

  const wordLength = requestedWordLength
    ? requestedWordLength
    : await getSmartDefaultWordLength({ userId, chatId, searchKey });

  let timeKey: LeaderboardPeriod;

  if (requestedTimeKey) {
    timeKey = requestedTimeKey;
  } else {
    timeKey = await getSmartDefaultTimeKey({
      userId,
      chatId,
      searchKey,
      wordLength,
    });
  }

  let hasAnyScoresQuery = db
    .selectFrom("leaderboard")
    .select("userId")
    .where("userId", "=", userId)
    .where("wordLength", "=", toDbWordLength(wordLength))
    .limit(1);

  if (searchKey === "group") {
    hasAnyScoresQuery = hasAnyScoresQuery.where("chatId", "=", chatId);
  }

  const hasAnyScores = !!(await hasAnyScoresQuery.executeTakeFirst());

  return { searchKey, timeKey, wordLength, hasAnyScores };
}

async function getSmartDefaultWordLength({
  userId,
  chatId,
  searchKey,
}: {
  userId: string;
  chatId: string;
  searchKey: LeaderboardScope;
}): Promise<WordLength> {
  const preferenceOrder: WordLength[] = [5, 4, 6];

  for (const length of preferenceOrder) {
    let query = db
      .selectFrom("leaderboard")
      .select("userId")
      .where("userId", "=", userId)
      .where("wordLength", "=", toDbWordLength(length))
      .limit(1);

    if (searchKey === "group") {
      query = query.where("chatId", "=", chatId);
    }

    const exists = await query.executeTakeFirst();
    if (exists) return length;
  }

  return 5;
}

async function getSmartDefaultTimeKey({
  userId,
  chatId,
  searchKey,
  wordLength,
}: {
  userId: string;
  chatId: string;
  searchKey: LeaderboardScope;
  wordLength: WordLength;
}): Promise<LeaderboardPeriod> {
  let query = db
    .selectFrom("leaderboard")
    .select("createdAt")
    .where("userId", "=", userId)
    .where("wordLength", "=", toDbWordLength(wordLength))
    .orderBy("createdAt", "desc")
    .limit(1);

  if (searchKey === "group") {
    query = query.where("chatId", "=", chatId);
  }

  const latestEntry = await query.executeTakeFirst();

  if (!latestEntry) return "all";

  const now = new Date();
  const latestDate = new Date(latestEntry.createdAt);

  if (
    latestDate.getFullYear() === now.getFullYear() &&
    latestDate.getMonth() === now.getMonth() &&
    latestDate.getDate() === now.getDate()
  ) {
    return "today";
  }

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  if (latestDate >= startOfWeek) return "week";

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (latestDate >= startOfMonth) return "month";

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  if (latestDate >= startOfYear) return "year";

  return "all";
}
