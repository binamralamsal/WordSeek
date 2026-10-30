import { CronJob } from "cron";

import { env } from "#/config/env";
import { createLogger } from "#/core/logging/logger.service";

import { compactLeaderboard } from "./services/leaderboard-compaction.service";

const log = createLogger("features.scores.leaderboard-compaction.cron");

export const leaderboardCompactionCron = new CronJob(
  "15 0 * * *",
  async () => {
    try {
      const result = await compactLeaderboard();

      if (result) {
        log.info(result, "Leaderboard compaction finished");
      }
    } catch (error) {
      log.error({ err: error }, "Leaderboard compaction failed");
    }
  },
  null,
  false,
  env.TIME_ZONE,
);
