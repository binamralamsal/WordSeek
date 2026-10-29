import { Composer } from "grammy";

import { redis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys.constants";

import { handleRegularGuess } from "./regular/guesses.handler";
import { handleDailyWordleGuess } from "./daily/guesses.handler";
import { getCurrentGameDateString } from "./daily/helpers/date.helper";
import { dailyWordleSchema } from "./shared/helpers/daily-session.helper";

const composer = new Composer();

composer.on("message:text", async (ctx) => {
  const currentGuess = ctx.message.text?.toLowerCase();

  const isValidWord = /^[a-z]{4,6}$/.test(currentGuess ?? "");

  if (!isValidWord || currentGuess.startsWith("/")) {
    return;
  }

  const userId = ctx.from.id.toString();

  if (ctx.chat.type === "private") {
    const dailyGameData = await redis.get(redisKeys.dailySession(userId));
    const result = dailyWordleSchema.safeParse(
      JSON.parse(dailyGameData || "{}"),
    );

    if (result.success) {
      const todayDate = getCurrentGameDateString();

      if (result.data.date !== todayDate) {
        await redis.del(redisKeys.dailySession(userId));
        return ctx.reply(
          "Your previous game has expired. Please start today's WordSeek with /daily",
        );
      }

      return handleDailyWordleGuess(ctx, currentGuess);
    }
  }

  return handleRegularGuess(ctx, currentGuess);
});

export const wordleTextHandler = composer;
