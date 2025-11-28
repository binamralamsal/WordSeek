import { z } from "zod";

export const env = z
  .object({
    BOT_TOKEN: z.string().min(1, { message: "BOT_TOKEN is required" }),
    DATABASE_URL: z.string().min(1, { message: "DATABASE_URL is required" }),
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    ADMIN_USERS: z
      .string()
      .default("")
      .transform((val) => val.split(",").filter(Boolean).map(Number)),
    REDIS_URI: z.string().default("redis://127.0.0.1:6379"),
    CUSTOM_API_ROOT: z
      .string()
      .url({ message: "CUSTOM_API_ROOT must be a valid URL" })
      .default("https://api.telegram.org"), // default to official API
    LOGS_CHANNEL: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined)),
    TIME_ZONE: z.string().optional().default("UTC"),
    DAILY_WORDLE_START_DATE: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD")
      .optional()
      .default("2025-01-01")
      .transform((val) => new Date(val)),
    DAILY_WORDLE_SECRET: z
      .string()
      .min(1, { message: "DAILY_WORDLE_SECRET is required" }),
    GEMINI_API_KEYS: z
      .string()
      .transform((val) => val.split(" ").filter(Boolean))
      .optional()
      .default([]),
  })
  .parse(process.env);
