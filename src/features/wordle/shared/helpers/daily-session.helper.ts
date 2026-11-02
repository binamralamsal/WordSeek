import { z } from "zod";

export const dailyWordleSchema = z.object({
  dailyWordId: z.number(),
  date: z.string(),
});

export type DailyWordleSession = z.infer<typeof dailyWordleSchema>;
