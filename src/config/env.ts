import { z } from "zod";

export const env = z
  .object({
    BOT_TOKEN: z.string().min(1, { message: "BOT_TOKEN is required" }),
    DATABASE_URL: z.string().min(1, { message: "DATABASE_URL is required" }),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    ADMIN_USERS: z
      .string()
      .default("")
      .transform((val) => val.split(",").filter(Boolean).map(Number)),
    REDIS_URI: z.string().default("redis://127.0.0.1:6379"),
    CUSTOM_API_ROOT: z
      .string()
      .url({ message: "CUSTOM_API_ROOT must be a valid URL" })
      .default("https://api.telegram.org"), // default to official API
    // Channel dedicated to tracking suspicious messages (anti-cheat).
    // This is intentionally separate from the system log channel below.
    LOGS_CHANNEL: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined)),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    LOG_DIR: z.string().default("logs"),
    LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
    LOG_TO_FILE: z
      .string()
      .default("true")
      .transform((v) => v !== "false"),
    // Optional Telegram channel that receives system errors/fatal logs.
    // Never point this at LOGS_CHANNEL: that one only tracks suspicious messages.
    SYSTEM_LOG_CHANNEL: z
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
