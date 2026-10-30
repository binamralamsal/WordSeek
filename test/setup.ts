/**
 * Test preload. Runs before any test file (and therefore before `config/env`
 * is imported) so the bot validates against deterministic fake settings.
 */
process.env.NODE_ENV = "test";
process.env.BOT_TOKEN = "123456:TEST-TOKEN";
process.env.DATABASE_URL =
  "postgres://wordseek:wordseek@127.0.0.1:5432/wordseek_test";
process.env.REDIS_URI = "redis://127.0.0.1:6399";
process.env.DAILY_WORDLE_SECRET = "test-daily-wordle-secret";
process.env.DAILY_WORDLE_START_DATE = "2025-01-01";
process.env.ADMIN_USERS = "999,1000";
process.env.TIME_ZONE = "UTC";
process.env.LOG_LEVEL = "silent";
process.env.LOG_TO_FILE = "false";
process.env.LOGS_CHANNEL = "555";
delete process.env.SYSTEM_LOG_CHANNEL;
