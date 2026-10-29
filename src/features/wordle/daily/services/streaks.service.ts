import { db } from "#/config/db";

import { createLogger } from "#/core/logging/logger.service";
import { getCurrentGameDateString } from "../helpers/date.helper";

const log = createLogger("features.wordle.daily.services.streaks.service");

export async function resetStreaksForInactivePlayers(yesterdayDate: string) {
  try {
    log.info(
      `Resetting streaks for players who didn't play on ${yesterdayDate}`,
    );

    const yesterdayDateTime = new Date(yesterdayDate + "T00:00:00");

    const result = await db
      .updateTable("userStats")
      .set({ currentStreak: 0 })
      .where("currentStreak", ">", 0)
      .where((eb) =>
        eb.or([
          eb("lastGuessed", "is", null),
          eb("lastGuessed", "<", yesterdayDateTime),
        ]),
      )
      .execute();

    const resetCount = result.reduce(
      (sum, r) => sum + Number(r.numUpdatedRows || 0n),
      0,
    );

    if (resetCount > 0) {
      log.info(`Reset streaks for ${resetCount} inactive players`);
    } else {
      log.info("No inactive players found to reset");
    }
  } catch (error) {
    log.error({ err: error }, "Error resetting streaks for inactive players:");
  }
}

export async function recordWinStreak(userId: string) {
  const userStats = await db
    .selectFrom("userStats")
    .selectAll()
    .where("userId", "=", userId)
    .executeTakeFirst();

  if (!userStats) return null;

  const todayDateString = getCurrentGameDateString();
  const todayDate = new Date(todayDateString + "T00:00:00");

  let newStreak = 1;

  if (userStats.lastGuessed) {
    const lastGuessedDate = new Date(userStats.lastGuessed);
    lastGuessedDate.setHours(0, 0, 0, 0);

    const diffTime = todayDate.getTime() - lastGuessedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreak = userStats.currentStreak + 1;
    } else if (diffDays === 0) {
      newStreak = userStats.currentStreak;
    }
  }

  const newHighestStreak = Math.max(newStreak, userStats.highestStreak);

  await db
    .updateTable("userStats")
    .set({
      currentStreak: newStreak,
      highestStreak: newHighestStreak,
      lastGuessed: new Date().toISOString(),
    })
    .where("userId", "=", userId)
    .execute();

  return { currentStreak: newStreak, highestStreak: newHighestStreak };
}

export async function resetStreak(userId: string) {
  await db
    .updateTable("userStats")
    .set({
      currentStreak: 0,
      lastGuessed: new Date().toISOString(),
    })
    .where("userId", "=", userId)
    .execute();
}
