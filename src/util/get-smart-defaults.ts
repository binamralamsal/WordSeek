import { db } from "../config/db";
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

  let hasAnyScoresQuery = db
    .selectFrom("leaderboard")
    .select("userId")
    .where("userId", "=", userId)
    .limit(1);

  if (searchKey === "group") {
    hasAnyScoresQuery = hasAnyScoresQuery.where("chatId", "=", chatId);
  }

  const hasAnyScores = !!(await hasAnyScoresQuery.executeTakeFirst());

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
  let query = db
    .selectFrom("leaderboard")
    .select("createdAt")
    .where("userId", "=", userId)
    .orderBy("createdAt", "desc")
    .limit(1);

  if (searchKey === "group") {
    query = query.where("chatId", "=", chatId);
  }

  const latestEntry = await query.executeTakeFirst();

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
