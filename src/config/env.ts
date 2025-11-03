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
  })
  .parse(process.env);
