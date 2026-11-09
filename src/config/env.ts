import { z } from "zod";

export const env = z
  .object({
    BOT_TOKEN: z.string().min(1, { message: "BOT_TOKEN is required" }),
    // Use Telegram's separate Bot API test environment with a test token.
    TELEGRAM_TEST_SERVER: z
      .string()
      .default("false")
      .transform((v) => v.toLowerCase() === "true"),
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
    // Public HTTPS origin of the Mini App. When set, the bot advertises the
    // app in the chat menu and `/app`.
    MINIAPP_URL: z.string().url().optional(),
    // Short name configured in BotFather for direct Mini App links.
    MINIAPP_SHORT_NAME: z.string().default("app"),
    MINIAPP_PORT: z.coerce.number().int().positive().default(3000),
    // Interface binding for the Mini App HTTP server (defaults to all hosts).
    PORT: z.coerce.number().int().positive().optional(),
    MINIAPP_STATIC_DIR: z.string().default("dist/miniapp"),
    MINIAPP_AUTH_MAX_AGE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(86_400),
    // Development-only escape hatch for opening the UI in a normal browser.
    // Never used when NODE_ENV is production.
    MINIAPP_DEV_USER_ID: z.string().optional(),
  })
  .parse(process.env);
