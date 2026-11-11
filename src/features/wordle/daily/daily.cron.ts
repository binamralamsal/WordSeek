import { CronJob } from "cron";

import { env } from "#/config/env";

import { generateDailyWord } from "./services/daily-word.service";

export const dailyWordleCron = new CronJob(
  "0 6 * * *",
  generateDailyWord,
  null,
  false,
  env.TIME_ZONE,
);
