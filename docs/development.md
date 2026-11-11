# Development guide

This is the practical guide for running, changing, testing and deploying
WordSeek. For the system design, see [architecture.md](architecture.md). For the
condensed agent checklist, see [AGENTS.md](../AGENTS.md).

## Prerequisites

- **Bun 1.4.4** (pinned in `.bun-version`). The project uses Bun's runtime,
  package manager, test runner, formatter, linter and type checker. Node.js is
  not a supported runtime.
- **PostgreSQL** (a local database is enough for development).
- **Redis** (sessions, votes, tracking, broadcast state and BullMQ).
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather).
- Optional: a Telegram Bot API test-environment token when
  `TELEGRAM_TEST_SERVER=true`.
- Optional: Gemini API keys for daily-word meanings and phonetics.

## First-time setup

The Mini App API and bot share one long-running Bun process. Build the UI with
`bun run build:miniapp`. Set `MINIAPP_URL` to its public HTTPS URL so Telegram
can open it. The HTTP server binds to `0.0.0.0` on `PORT`, falling back to
`MINIAPP_PORT` (default `3000`). Use `TELEGRAM_TEST_SERVER=true` only with a
token created for Telegram's test environment; it selects grammY's `test`
client environment.

```bash
git clone https://github.com/binamralamsal/WordSeek
cd WordSeek
bun install
```

Create the environment file:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in at least:

```env
BOT_TOKEN=123456789:your-token
DATABASE_URL=postgresql://postgres:password@localhost:5432/wordseek
DAILY_WORDLE_SECRET=change-me
```

Create the database, then apply migrations:

```bash
bun run db:migrate latest
```

Start in watch mode:

```bash
bun run dev
```

`bun run start` runs it once without watch. A successful start deletes any
webhook, begins long polling, starts crons and the captcha worker, syncs the
command menu and resumes a pending broadcast.

> Run exactly one process per bot token. Two pollers cause lost and duplicated
> updates. Use PM2 `fork` mode (`exec_mode: "fork"`, `instances: 1`), never
> cluster mode.

## Environment variables

`src/config/env.ts` is authoritative. `.env.example` is the documented template.

| Variable                       | Required | Default                    | Notes                                                                      |
| ------------------------------ | -------- | -------------------------- | -------------------------------------------------------------------------- |
| `BOT_TOKEN`                    | yes      | —                          | Telegram bot token.                                                        |
| `DATABASE_URL`                 | yes      | —                          | PostgreSQL connection string.                                              |
| `DAILY_WORDLE_SECRET`          | yes      | —                          | Seed for the deterministic daily word order.                               |
| `REDIS_URI`                    | no       | `redis://127.0.0.1:6379`   | Redis connection.                                                          |
| `NODE_ENV`                     | no       | `development`              | `development`, `production` or `test`.                                     |
| `ADMIN_USERS`                  | no       | empty                      | Comma-separated Telegram user IDs with bot-admin rights.                   |
| `TIME_ZONE`                    | no       | `UTC`                      | Timezone for cron schedules and daily boundaries.                          |
| `DAILY_WORDLE_START_DATE`      | no       | `2025-01-01`               | First day of the daily-word rotation (`YYYY-MM-DD`).                       |
| `GEMINI_API_KEYS`              | no       | empty                      | Space-separated Gemini keys. Without keys, daily word details are omitted. |
| `CUSTOM_API_ROOT`              | no       | `https://api.telegram.org` | Alternate Telegram Bot API root.                                           |
| `LOGS_CHANNEL`                 | no       | empty                      | Anti-cheat alerts only.                                                    |
| `SYSTEM_LOG_CHANNEL`           | no       | empty                      | Unexpected errors/fatal failures only.                                     |
| `LOG_LEVEL`                    | no       | `info`                     | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.              |
| `LOG_DIR`                      | no       | `logs`                     | Daily log file directory.                                                  |
| `LOG_RETENTION_DAYS`           | no       | `14`                       | Days of daily files to keep.                                               |
| `LOG_TO_FILE`                  | no       | `true`                     | Set `false` to log only to stdout.                                         |
| `MINIAPP_URL`                  | no       | empty                      | Public HTTPS origin of the Mini App. Enables `/app` and the chat menu.     |
| `MINIAPP_SHORT_NAME`           | no       | `app`                      | BotFather short name used by group `/app` links.                           |
| `MINIAPP_PORT`                 | no       | `3000`                     | Mini App HTTP port when `PORT` is not set.                                 |
| `MINIAPP_STATIC_DIR`           | no       | `dist/miniapp`             | Built frontend directory served by Bun.                                    |
| `MINIAPP_AUTH_MAX_AGE_SECONDS` | no       | `86400`                    | Maximum accepted age of signed Telegram `initData`.                        |
| `MINIAPP_DEV_USER_ID`          | no       | empty                      | Development-only user ID for browser previews; ignored in production.      |

`LOGS_CHANNEL` and `SYSTEM_LOG_CHANNEL` must not be the same chat. The first is
for suspicious-message tracking; the second is for crashes.

### Mini App frontend

The React frontend lives in `web/` and is bundled into `dist/miniapp` by Vite.
It uses the shared pure modules in `src/shared/` for scoring, leaderboard types
and nickname validation, so the API and UI cannot drift apart.

```bash
bun run dev:miniapp      # Vite dev server with hot reload
bun run build:miniapp    # production bundle served by the Bun process
bun run preview:miniapp  # inspect the production bundle locally
bun run check:web        # type check the frontend (part of verify)
```

Set `MINIAPP_URL` to the public HTTPS origin in production. For browser-only
testing, set `MINIAPP_DEV_USER_ID` (development only) and start Vite; API
requests then send `X-Dev-User-Id` instead of Telegram `initData`.

## Day-to-day commands

```bash
bun run dev             # watch mode
bun run start           # production-style start
bun test                # full test suite
bun test:watch          # watch tests
bun test:coverage       # coverage report
bun test:check          # type check tests before running
bun test test/integration/scores.test.ts
bun fmt                 # format
bun fmt:check           # formatting gate used by CI
bun lint                # lint (warnings do not fail)
bun lint:fix            # safe autofixes
bun lint:type-aware     # opt-in, currently noisy
bun check               # type check
bun run check:web       # type check the Mini App frontend
bun run verify          # fmt:check + lint + check + check:web + test
```

Run `bun run verify` before committing. CI runs the same command with the Bun
version from `.bun-version` and `bun install --frozen-lockfile`.

## Formatting, linting and imports

Configuration is in `bunfig.toml`:

- 80-column lines, 2-space indentation, trailing commas.
- Import groups: `grammy`, `@grammyjs/*`, built-ins and packages, `#/*`
  aliases, then relative imports. Each group is sorted alphabetically and
  separated by a blank line.
- `no-console` and a few other rules are warnings; `scripts/**` may use
  `console`.

Use `#/` for `src/` imports and relative paths inside a feature folder. Files
use role suffixes: `.command.ts`, `.callback.ts`, `.handler.ts`,
`.middleware.ts`, `.service.ts`, `.helper.ts`, `.guard.ts`, `.schema.ts`,
`.constants.ts`, `.cron.ts`, `.stream.ts`.

## Testing

The suite needs no external services:

- `test/setup.ts` preloads deterministic environment variables before
  `src/config/env.ts` is imported.
- `test/helpers/pglite.ts` starts in-memory Postgres (PGlite), runs the real
  migrations from `migrations/`, and registers it as the app database.
- `test/helpers/redis-mock.ts` installs an in-memory Redis.
- `test/helpers/harness.ts` mounts the real `createAppComposer()` stack on a
  grammY `Bot` whose API calls are recorded instead of sent.

Typical integration test:

```ts
import { describe, expect, test } from "bun:test";

import { setupTestEnvironment } from "../helpers/env";
import { TestBot } from "../helpers/harness";

const env = setupTestEnvironment();

describe("/leaderboard", () => {
  test("renders scores", async () => {
    const bot = new TestBot();
    await bot.sendText("/leaderboard", { id: 999 });

    expect(bot.lastText()).toContain("Leaderboard");
  });
});
```

Useful harness methods:

- `bot.sendText(text, options)` sends a text update. Options include `id`,
  `chatId`, `chatType` (`private`, `group`, `supergroup`, `forum`), `title`,
  `isForum`, `messageThreadId`, `replyTo` and `date`.
- `bot.sendCallback(data, options)` sends a callback query.
- `bot.lastText()` / `bot.texts()` read the most recent or all rendered
  messages.
- `bot.calls` records every Telegram API method and payload, so you can assert
  that a draft was not sent or that a message was edited.

Helpers in `test/helpers/fixtures.ts` seed users, games, scores and daily data.
Tables are truncated between tests. Prefer integration tests for routing,
permissions and side effects; use unit tests for pure helpers.

Coverage expectations when behavior changes:

- DM vs group differences.
- Bot-admin vs group-admin boundaries.
- Banned users and topic restrictions.
- Database writes (scores, games, daily guesses) and Redis state.
- Exact Telegram methods when the difference matters.

## Database workflow

### Apply migrations

```bash
bun run db:migrate latest
```

### Create a migration

```bash
bun run db:migrate make add_something
```

This creates a timestamped file in `migrations/`. Implement `up` and `down`.
Follow the existing style, including `Kysely<any>` and comments for indexes.

Never edit a migration that has already been applied in an environment. Add a
new one instead.

### Regenerate types

```bash
bun run db:codegen
```

This regenerates `src/database/schema.ts` from the live database with
`kysely-codegen --singularize --camel-case`. Commit the result. Do not hand-edit
the file.

### Compaction

```bash
bun run db:compact
```

This is the same logic as the nightly cron. It merges only rows older than the
current month, preserves every leaderboard filter total, and uses an advisory
lock so an overlapping cron/manual run skips instead of conflicting.

## Debugging

- **Logs**: JSON on stdout; daily files in `LOG_DIR`. Use `bun run dev` and
  `LOG_LEVEL=debug` for SQL query logs in development.
- **Database**: inspect `users`, `games`, `guesses`, `leaderboard`,
  `daily_words` and `daily_guesses`. `games.active_chat` is the quickest way to
  find a stuck game.
- **Redis**: inspect `vote:*`, `daily_wordle:*`, `captcha:*`, `tracking:*` and
  `broadcast:*`. Use the key builders in
  `src/core/redis-keys.constants.ts`.
- **Daily word not ready**: `ensureDailyWordExists` logs and returns `null` on
  failure; the 06:00 cron retries. Check Gemini keys and the database.
- **Bot silent in a group**: confirm it is an admin with read access, that the
  topic is registered for play, and that the user is not banned.
- **Bot leaves a group**: the error handler leaves when Telegram reports
  "not enough rights to send text messages".
- **Topic errors**: if a forum topic was deleted and recreation is enabled, the
  error handler creates a new topic and updates `chat_game_topics`.

## Deployment and operations

1. Install dependencies with the pinned Bun version.
2. Apply migrations with `bun run db:migrate latest`.
3. Start one process with `bun run start` under a process manager.
4. Keep PostgreSQL and Redis reachable; the bot retries connections but cannot
   function without them.
5. Watch stdout logs or `LOG_DIR`; optionally set `SYSTEM_LOG_CHANNEL` for
   crash alerts and `LOGS_CHANNEL` for anti-cheat alerts.
6. On shutdown, `SIGINT`/`SIGTERM` stop polling and jobs, close connections and
   exit within 10 seconds.

PM2 example (fork mode, one instance):

```js
module.exports = {
  name: "wordseek",
  script: "bun",
  args: "run start",
  exec_mode: "fork",
  instances: 1,
  autorestart: true,
  max_restarts: 10,
};
```

Do not add Vercel or other serverless configuration. The bot needs a persistent
polling process, PostgreSQL and Redis. Do not add `bun.lockb`; the text
`bun.lock` is the lockfile.

## Contribution workflow

1. Branch from `master`.
2. Make the change in the existing feature folder; keep files role-named.
3. Add or update tests.
4. Add a migration and regenerate types if the schema changed.
5. Update `README.md`, `.env.example` or these docs when behavior or
   configuration changes.
6. Run:
   ```bash
   bun run verify
   ```
7. Review the diff and commit with a conventional, imperative message:
   `feat:`, `fix:`, `perf:`, `docs:`, `test:`, `build:`, `style:` or `revert:`.
8. Push and open a pull request. State the user-visible change, any migration
   requirement and the verification performed.
9. Confirm CI is green before merging.

## Pull request checklist

- [ ] `bun run verify` passes.
- [ ] New behavior has tests, including DM/group and permission boundaries.
- [ ] No secrets, `.env`, tokens or production data committed.
- [ ] Schema changes have a new migration and regenerated
      `src/database/schema.ts`.
- [ ] New env vars are in `src/config/env.ts`, `.env.example`, the README table
      and `test/setup.ts` when needed.
- [ ] New commands are registered and appear in the command menu if public.
- [ ] New callbacks are registered before the catch-all.
- [ ] User-controlled text is escaped before rich HTML.
- [ ] `bun.lock` (not `bun.lockb`) is the only lockfile.
- [ ] Deployment notes mention any required migration or configuration change.

## Troubleshooting

| Symptom                           | Likely cause                     | Fix                                                  |
| --------------------------------- | -------------------------------- | ---------------------------------------------------- |
| `BOT_TOKEN is required`           | Missing `.env` or env var        | Fill `.env` from `.env.example`.                     |
| `DATABASE_URL is required`        | Missing database config          | Set `DATABASE_URL`.                                  |
| `DAILY_WORDLE_SECRET is required` | Missing daily secret             | Set any non-empty secret.                            |
| Database connection errors        | PostgreSQL down or wrong URL     | Start Postgres and check the URL.                    |
| Redis connection errors           | Redis down or wrong URI          | Start Redis and check `REDIS_URI`.                   |
| Bot does not respond              | Invalid token or another poller  | Check the token and run a single instance.           |
| Duplicate/ignored updates         | Two bot processes                | Stop all but one process.                            |
| `NaN` in `/stats`                 | Raw SQL keys read as snake_case  | Read camelCase keys (`totalUsers`, etc.).            |
| Leaderboard IDs missing           | Group chat or non-admin DM       | Expected privacy behavior.                           |
| Daily game blocked                | Active regular game              | Finish or `/end` the regular game.                   |
| Regular game blocked              | Active daily session             | Use `/pausedaily`.                                   |
| Topic rejected                    | Topic not registered             | Use `/setgametopic` or play in the registered topic. |
| Migration errors                  | Permissions or pending migration | Check DB permissions and run `latest`.               |

## Documentation map

- [README.md](../README.md): overview, commands and setup.
- [architecture.md](architecture.md): update flow, features, data, Redis, jobs.
- [development.md](development.md): this guide.
- [AGENTS.md](../AGENTS.md): quick rules and repository map for coding agents.
