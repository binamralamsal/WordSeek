import { and, desc, eq } from "drizzle-orm";

import { db } from "../drizzle/db";
import { leaderboardTable, usersTable } from "../drizzle/schema";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

export async function getSmartDefaults({
  userId,
  chatId,
  requestedSearchKey,
  requestedTimeKey,
  chatType,
}: {
  userId: string;
  chatId: string;
  requestedSearchKey?: AllowedChatSearchKey;
  requestedTimeKey?: AllowedChatTimeKey;
  chatType: string;
}) {
  let searchKey: AllowedChatSearchKey =
    requestedSearchKey || (chatType === "private" ? "global" : "group");

  if (searchKey === "group" && chatType !== "private") {
    const [groupScoresExist] = await db
      .select()
      .from(leaderboardTable)
      .innerJoin(usersTable, eq(leaderboardTable.userId, usersTable.id))
      .where(
        and(
          eq(leaderboardTable.chatId, chatId),
          eq(usersTable.telegramUserId, userId),
        ),
      )
      .limit(1);

    if (!groupScoresExist) {
      searchKey = "global";
    }
  }

  let timeKey: AllowedChatTimeKey;

  if (requestedTimeKey) {
    timeKey = requestedTimeKey;
  } else {
    timeKey = await getSmartDefaultTimeKey({
      userId,
      chatId,
      searchKey,
    });
  }

  const [hasAnyScoresQuery] = await db
    .select()
    .from(leaderboardTable)
    .innerJoin(usersTable, eq(leaderboardTable.userId, usersTable.id))
    .where(
      and(
        eq(usersTable.telegramUserId, userId),
        searchKey === "group" ? eq(leaderboardTable.chatId, chatId) : undefined,
      ),
    )
    .limit(1);

  const hasAnyScores = !!hasAnyScoresQuery;

  return { searchKey, timeKey, hasAnyScores };
}

async function getSmartDefaultTimeKey({
  userId,
  chatId,
  searchKey,
}: {
  userId: string;
  chatId: string;
  searchKey: AllowedChatSearchKey;
}): Promise<AllowedChatTimeKey> {
  const [latestEntry] = await db
    .select({
      createdAt: leaderboardTable.createdAt,
    })
    .from(leaderboardTable)
    .innerJoin(usersTable, eq(leaderboardTable.userId, usersTable.id))
    .where(
      and(
        eq(usersTable.telegramUserId, userId),
        searchKey === "group" ? eq(leaderboardTable.chatId, chatId) : undefined,
      ),
    )
    .orderBy(desc(leaderboardTable.createdAt))
    .limit(1);

  if (!latestEntry) {
    return "all";
  }

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

  if (latestDate >= startOfWeek) {
    return "week";
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (latestDate >= startOfMonth) {
    return "month";
  }

  const startOfYear = new Date(now.getFullYear(), 0, 1);

  if (latestDate >= startOfYear) {
    return "year";
  }

  return "all";
}
