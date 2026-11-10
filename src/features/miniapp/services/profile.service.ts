import { sql } from "kysely";

import { db } from "#/config/db";
import type {
  MiniAppGroupContext,
  MiniAppProfile,
  MiniAppProfileStats,
  MiniAppPublicProfile,
  MiniAppPublicUser,
  MiniAppUser,
  NicknameUpdateResponse,
} from "#/shared/miniapp";
import { validateNickname } from "#/shared/nickname";

import { getCurrentGameDateString } from "../../wordle/daily/helpers/date.helper";
import { ensureUserStats } from "../../wordle/daily/services/streaks.service";

type UserRow = {
  id: string;
  name: string;
  nickname: string | null;
  username: string | null;
  photoUrl: string | null;
  createdAt: Date;
};

function toMiniAppUser(user: UserRow): MiniAppUser {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    displayName: user.nickname?.trim() || user.name,
    username: user.username,
    photoUrl: user.photoUrl,
  };
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const row = await db
    .selectFrom("bannedUsers")
    .select("userId")
    .where("userId", "=", userId)
    .executeTakeFirst();

  return Boolean(row);
}

export async function getUserRow(userId: string) {
  return await db
    .selectFrom("users")
    .select(["id", "name", "nickname", "username", "photoUrl", "createdAt"])
    .where("id", "=", userId)
    .executeTakeFirst();
}

function toPublicUser(user: UserRow): MiniAppPublicUser {
  return {
    id: user.id,
    displayName: user.nickname?.trim() || user.name,
    username: user.username,
    photoUrl: user.photoUrl,
  };
}

export async function findMiniAppUser(
  query: string,
): Promise<MiniAppPublicUser | null> {
  const normalized = query.trim().replace(/^@/, "");
  if (!normalized) return null;

  const user = /^\d+$/.test(normalized)
    ? await db
        .selectFrom("users")
        .select(["id", "name", "nickname", "username", "photoUrl", "createdAt"])
        .where("id", "=", normalized)
        .executeTakeFirst()
    : /^[a-zA-Z0-9_]{5,32}$/.test(normalized)
      ? await db
          .selectFrom("users")
          .select([
            "id",
            "name",
            "nickname",
            "username",
            "photoUrl",
            "createdAt",
          ])
          .where("username", "ilike", normalized)
          .executeTakeFirst()
      : undefined;

  return user ? toPublicUser(user) : null;
}

export async function getMiniAppPublicProfile(
  userId: string,
  group: MiniAppGroupContext | null,
): Promise<MiniAppPublicProfile | null> {
  const user = await getUserRow(userId);

  if (!user) return null;
  await ensureUserStats(user.id);
  const { classicWins: _, ...publicStats } = await getProfileStats(
    user.id,
    user.createdAt,
  );

  return {
    user: toPublicUser(user),
    stats: publicStats,
    group,
  };
}

export async function getProfileStats(
  userId: string,
  joinedAt: Date,
): Promise<MiniAppProfileStats> {
  const dailyWord = await db
    .selectFrom("dailyWords")
    .select(["id", "word"])
    .where("date", "=", new Date(getCurrentGameDateString()))
    .executeTakeFirst();

  const [userStats, scoreRow, dailyRow] = await Promise.all([
    db
      .selectFrom("userStats")
      .select([
        "currentStreak",
        "highestStreak",
        "classicGamesWon",
        "dailyGamesPlayed",
        "dailyGamesWon",
        "dailyGamesLost",
      ])
      .where("userId", "=", userId)
      .executeTakeFirst(),
    db
      .selectFrom("leaderboard")
      .select([
        sql<number>`coalesce(cast(sum(score) as integer), 0)`.as("totalScore"),
        sql<number>`coalesce(cast(max(least(score, 30)) as integer), 0)`.as(
          "bestScore",
        ),
      ])
      .where("userId", "=", userId)
      .executeTakeFirst(),
    dailyWord
      ? db
          .selectFrom("dailyGuesses")
          .select(["guess"])
          .where("userId", "=", userId)
          .where("dailyWordId", "=", dailyWord.id)
          .orderBy("attemptNumber", "asc")
          .execute()
      : Promise.resolve([]),
  ]);

  const guesses = dailyRow ?? [];
  const classicWins = Number(userStats?.classicGamesWon ?? 0);
  const dailyGames = Number(userStats?.dailyGamesPlayed ?? 0);
  const dailyWins = Number(userStats?.dailyGamesWon ?? 0);
  const dailyLosses = Number(userStats?.dailyGamesLost ?? 0);

  return {
    totalScore: Number(scoreRow?.totalScore ?? 0),
    classicWins,
    dailyGames,
    dailyWins,
    dailyLosses,
    bestScore: Number(scoreRow?.bestScore ?? 0),
    currentStreak: Number(userStats?.currentStreak ?? 0),
    highestStreak: Number(userStats?.highestStreak ?? 0),
    dailyPlayedToday: guesses.length > 0,
    dailySolvedToday: Boolean(
      dailyWord && guesses.some((guess) => guess.guess === dailyWord.word),
    ),
    memberSince: joinedAt.toISOString(),
  };
}

export async function getMiniAppProfile(
  userId: string,
  group: MiniAppGroupContext | null,
): Promise<MiniAppProfile | null> {
  const user = await getUserRow(userId);
  if (!user) return null;

  await ensureUserStats(userId);

  return {
    user: toMiniAppUser(user),
    stats: await getProfileStats(userId, user.createdAt),
    group,
  };
}

export async function updateNickname(
  userId: string,
  input: unknown,
): Promise<
  | { ok: true; data: NicknameUpdateResponse }
  | { ok: false; code: string; message: string }
> {
  const validation = validateNickname(input);

  if (!validation.ok) {
    return {
      ok: false,
      code: "INVALID_NICKNAME",
      message: validation.message,
    };
  }

  const updated = await db
    .updateTable("users")
    .set({ nickname: validation.value, updatedAt: new Date() })
    .where("id", "=", userId)
    .returning(["id", "name", "nickname", "username", "photoUrl", "createdAt"])
    .executeTakeFirst();

  if (!updated) {
    return {
      ok: false,
      code: "USER_NOT_FOUND",
      message: "Your WordSeek profile could not be loaded.",
    };
  }

  return {
    ok: true,
    data: {
      nickname: validation.value,
      user: toMiniAppUser(updated),
    },
  };
}

export { toMiniAppUser };
