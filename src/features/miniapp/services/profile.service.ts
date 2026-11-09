import { sql } from "kysely";

import { db } from "#/config/db";
import type {
  MiniAppGroupContext,
  MiniAppProfile,
  MiniAppProfileStats,
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

export async function getProfileStats(
  userId: string,
): Promise<MiniAppProfileStats> {
  const dailyWord = await db
    .selectFrom("dailyWords")
    .select(["id", "word"])
    .where("date", "=", new Date(getCurrentGameDateString()))
    .executeTakeFirst();

  const [userStats, scoreRow, classicRow, dailyRow, firstGame] =
    await Promise.all([
      db
        .selectFrom("userStats")
        .select(["currentStreak", "highestStreak"])
        .where("userId", "=", userId)
        .executeTakeFirst(),
      db
        .selectFrom("leaderboard")
        .select([
          sql<number>`coalesce(cast(sum(score) as integer), 0)`.as(
            "totalScore",
          ),
          sql<number>`coalesce(cast(max(score) as integer), 0)`.as("bestScore"),
        ])
        .where("userId", "=", userId)
        .executeTakeFirst(),
      db
        .selectFrom("miniAppGames")
        .select([
          sql<number>`cast(count(*) as integer)`.as("games"),
          sql<number>`cast(count(*) filter (where status = 'won') as integer)`.as(
            "wins",
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
      db
        .selectFrom("leaderboard")
        .select("createdAt")
        .where("userId", "=", userId)
        .orderBy("createdAt", "asc")
        .limit(1)
        .executeTakeFirst(),
    ]);

  const guesses = dailyRow ?? [];

  return {
    totalScore: Number(scoreRow?.totalScore ?? 0),
    classicGames: Number(classicRow?.games ?? 0),
    classicWins: Number(classicRow?.wins ?? 0),
    bestScore: Number(scoreRow?.bestScore ?? 0),
    currentStreak: Number(userStats?.currentStreak ?? 0),
    highestStreak: Number(userStats?.highestStreak ?? 0),
    dailyPlayedToday: guesses.length > 0,
    dailySolvedToday: Boolean(
      dailyWord && guesses.some((guess) => guess.guess === dailyWord.word),
    ),
    memberSince: (firstGame?.createdAt ?? new Date()).toISOString(),
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
    stats: await getProfileStats(userId),
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
