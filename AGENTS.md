# AGENTS.md

Instructions for AI coding agents (and humans) working on WordSeek.

This file is the quick, opinionated map. The deeper references are
[docs/architecture.md](docs/architecture.md) and
[docs/development.md](docs/development.md). When they disagree with the code,
the code wins; update the docs in the same change.

## What this project is

WordSeek is a Telegram bot built with **grammY** and **Bun**. People play a
Wordle-style word game in private chats or groups, compete on group and global
leaderboards, and can play a daily puzzle. Admins get moderation, captcha,
broadcast, tracking and statistics tools.

The process is long-running: it polls Telegram, runs cron jobs and a BullMQ
worker. It is **not** a serverless/Vercel app.

## Quick start

```bash
bun install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
bun run db:migrate latest
bun run dev                   # watch mode
```

Before finishing any change:

```bash
bun run verify                # fmt:check + lint + typecheck + tests
```

Individual commands:

```bash
bun fmt
bun lint
bun check                     # type check, replaces tsc --noEmit
bun test
bun test test/integration/scores.test.ts
bun run db:codegen            # regenerate src/database/schema.ts
```

CI (`.github/workflows/ci.yml`) runs exactly `bun run verify` on every pull
request and on pushes to `master`.

## Non-negotiable rules

1. **Run `bun run verify` before you say the work is done.** Fix failures; do
   not report success with a red check.
2. **Keep `bun.lock`.** It is the text lockfile. Never reintroduce
   `bun.lockb`, and do not hand-edit the lockfile.
3. **Never commit `.env`, tokens, API keys or real user data.** `.env.example`
   is the canonical list of variables; `.env` is ignored.
4. **Never edit an already-applied migration.** Add a new timestamped file.
   After a schema change, run `bun run db:codegen` and commit the updated
   `src/database/schema.ts`.
5. **Run one bot process per token.** Polling with two instances causes lost
   and duplicated updates. Use PM2 `fork` mode or one replica.
6. **Do not break the rich-message UI.** Escape user-controlled text before
   putting it in HTML, and keep buttons inside rich messages via
   `renderInlineKeyboard`.
7. **Respect privacy.** `ADMIN_USERS` may reveal Telegram user IDs on
   `/leaderboard` only in DMs. Never expose IDs in groups or to non-admins.
8. **Add tests with behavior changes**, especially for permission boundaries,
   group vs private chat, and database side effects.

## Repository map

| Path                     | Responsibility                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`           | Process bootstrap: auto-retry, runner, crons, captcha worker, command sync, broadcast resume, graceful shutdown. |
| `src/app.ts`             | Root middleware stack shared by production and tests.                                                            |
| `src/config/`            | Zod-parsed env, bot, lazy Postgres/Redis proxies, constants.                                                     |
| `src/core/`              | Cross-feature guards, middleware, logging, formatting, Telegram/UI helpers, shared services.                     |
| `src/features/`          | One folder per user-facing feature. See below.                                                                   |
| `src/database/schema.ts` | Generated Kysely types. Do not hand-edit.                                                                        |
| `src/types/`             | Shared domain types (`LeaderboardScope`, `WordLength`, etc.).                                                    |
| `migrations/`            | Kysely migrations, ordered by timestamped filename.                                                              |
| `test/`                  | Unit tests and integration tests with PGlite + Redis mock.                                                       |
| `scripts/`               | One-off maintenance and migration tools.                                                                         |
| `docs/`                  | Architecture and development documentation.                                                                      |

### Feature folders

- `features/wordle/regular/`: `/new`, `/end`, guesses, end votes, game services.
- `features/wordle/daily/`: `/daily`, `/pausedaily`, daily word generation,
  streaks, Gemini word details.
- `features/wordle/shared/`: board rendering, hints, reactions, guards, types.
- `features/wordle/text.handler.ts`: routes plain 4–6 letter guesses to daily
  or regular play.
- `features/scores/`: `/score`, `/leaderboard`, filter parsing, formatting and
  leaderboard compaction.
- `features/admin/`: bans, captcha, stats, tracking, transfers, broadcasts.
- `features/general/`: `/start`, `/id`, `/score` alias, `/startmatch`.
- `features/group-settings/`: forum topics, allowed lengths, seek authorization.
- `features/help/`: help command, callbacks and message content.
- `features/command-router.ts`: canonical command registration and order.
- `features/callback-router.ts`: callback registration and catch-all ack.

## Update flow

Every Telegram update goes through `createAppComposer()` in `src/app.ts` in this
order:

1. `syncUserChatMiddleware`: upserts the user and chat without blocking.
2. `topicEditedMiddleware`: handles forum-topic edits.
3. `trackMessagesMiddleware`: anti-cheat detection, forwarding and tracking.
4. `sequentialize(...)`: serializes updates per group chat; private chats and
   callback queries are not serialized.
5. `bannedUsersMiddleware`: stops banned users (replies only in DM or when the
   bot is mentioned).
6. `commandRouter`: all slash commands.
7. `callbackRouter`: inline-button callbacks.
8. `wordleTextHandler`: plain 4–6 letter guesses.
9. `botMembershipMiddleware`: bot added/removed from a chat.

Order matters. Put a new command in `commandRouter`; put a new callback family
in `callbackRouter` before the catch-all `answerCallbackQuery`. Cross-cutting
middleware belongs in `app.ts`, not inside a command file.

## Commands and callbacks

- Command files export a grammY `Composer` named `<name>Command`.
- Register it in `src/features/command-router.ts`.
- If the command should appear in Telegram's command menu, add it to
  `advertisedCommands` there. Keep the existing order stable.
- Callback files export a composer and register in `callback-router.ts`.
- Use `ctx.answerCallbackQuery()` even when there is nothing to say, so the
  client spinner stops.
- Shared permission logic lives in `src/core/guards/admin.guard.ts`:
  `requireAdmin` is **group admin**, while `env.ADMIN_USERS` is **bot admin**.

## Data and state

### PostgreSQL (Kysely)

Main tables: `users`, `leaderboard`, `games`, `guesses`, `daily_words`,
`daily_guesses`, `user_stats`, `banned_users`, `authorized_users`,
`chat_game_topics`, `broadcast_chats`.

Important quirks:

- Kysely is configured with `CamelCasePlugin`. In normal query-builder code use
  camelCase columns. In **raw SQL**, result keys are also camelCased
  (`total_users` becomes `totalUsers`). Read the actual keys or you will get
  `NaN`/`undefined`.
- `leaderboard` rows store `wordLength` as `"4" | "5" | "6"` and `chatId` as a
  string. Private-chat IDs do not start with `-1`; group IDs do.
- Leaderboards aggregate first and join `users` only for the top 20 rows.
  Keep that shape when changing the query.
- `/stats` counts active players/groups in one leaderboard scan and relies on
  `leaderboard_chat_id_idx`. If you change that query, check the plan and the
  camelCase keys.
- Old leaderboard rows are compacted nightly at 00:15 in `TIME_ZONE`. The
  current month is intentionally not merged. Compaction must not change any
  filter total (today/week/month/year/all).
- Compaction takes a Postgres advisory lock; an overlapping manual run is a
  no-op, not a conflict.

### Redis

Key builders live in `src/core/redis-keys.constants.ts`. Do not invent literal
keys in feature code. Current state includes game end votes, daily sessions,
captcha sessions, tracked chats, greeting counters, failed Gemini keys,
broadcast state and the broadcast lock.

Redis is lazy-connected and proxied so tests can inject a mock. `setRedis` and
`setDatabase` are the test seams.

### Background work

- Daily word cron: `0 6 * * *` in `TIME_ZONE`, generates the word and resets
  inactive streaks.
- Leaderboard compaction: `15 0 * * *` in `TIME_ZONE`.
- Captcha worker: BullMQ delayed expiry job (60 seconds), started at boot.
- Broadcast: copies a replied-to message to every `broadcast_chats` row,
  persists progress in Redis, resumes on startup.

Start and stop every new cron/worker in `src/index.ts`.

## Code conventions

- TypeScript, strict mode, Bun APIs, ESM imports.
- Use the `#/` alias for `src/`, relative imports inside a feature.
- Role suffixes: `.command.ts`, `.callback.ts`, `.handler.ts`,
  `.middleware.ts`, `.service.ts`, `.helper.ts`, `.guard.ts`, `.schema.ts`,
  `.constants.ts`, `.cron.ts`, `.stream.ts`.
- Formatting: 80 columns, 2 spaces, trailing commas, LF. Import order is
  `grammy`, `@grammyjs/*`, built-ins/packages, `#/*`, then relative.
- Validate external input with Zod (`env`, sessions, captcha, AI output).
- Use the guard pattern instead of ad-hoc permission checks inside handlers.
- Use `createLogger("feature.module")`; do not add `console.log` in `src/`.
- User-facing text: prefer `ctx.replyWithRichMessage({ html })` for rich
  layouts, and `replyNotice(ctx, message)` for short escaped notices.
- Escape user-controlled strings with `escapeHtml` before rich HTML.
- Keep Telegram IDs as strings in database and Redis keys.

## Testing

The suite needs no external services:

- `test/setup.ts` sets deterministic env before modules import `config/env`.
- `test/helpers/pglite.ts` runs the real migrations in in-memory Postgres.
- `test/helpers/redis-mock.ts` replaces Redis.
- `test/helpers/harness.ts` mounts the real app composer on a grammY `Bot`
  whose API calls are recorded; no network is used.

Use the harness rather than calling handlers directly when you care about
routing, permissions or the exact Telegram methods. Assert on `bot.lastText()`,
`bot.texts()` and `bot.calls` (for example, ensure drafts are not sent).

Every test file calls `setupTestEnvironment()`. Tables are truncated between
tests. Use the fixtures in `test/helpers/fixtures.ts` to seed users, games and
scores. Run a focused file while iterating, then the full suite.

## Database changes

1. Create a new migration, for example:
   ```bash
   bun run db:migrate make add_something
   ```
2. Implement both `up` and `down`. Use `Kysely<any>` like existing migrations.
3. Apply it locally:
   ```bash
   bun run db:migrate latest
   ```
4. Regenerate types:
   ```bash
   bun run db:codegen
   ```
5. Add integration coverage.
6. Mention the required `bun run db:migrate latest` in the pull request and any
   release notes.

Indexes matter on `leaderboard`. When adding a filter, check that an index can
support it; explain new indexes in a comment.

## Environment

Read `src/config/env.ts` for the authoritative schema and `.env.example` for
documented defaults. Required values are `BOT_TOKEN`, `DATABASE_URL` and
`DAILY_WORDLE_SECRET`. Common optional values: `REDIS_URI`, `ADMIN_USERS`,
`TIME_ZONE`, `GEMINI_API_KEYS`, `LOGS_CHANNEL`, `SYSTEM_LOG_CHANNEL`,
`CUSTOM_API_ROOT` and the `LOG_*` settings.

Rules when adding a variable:

- Add it to the Zod schema with a safe default where possible.
- Add it to `.env.example` with a comment.
- Document it in `docs/development.md` and the README table.
- Set a deterministic value in `test/setup.ts` if tests import the config.

`LOGS_CHANNEL` (anti-cheat) and `SYSTEM_LOG_CHANNEL` (crashes) are different
channels and must not be the same chat.

## Deployment and operations

- Apply migrations before starting the new code.
- Run exactly one instance per bot token. PM2 `fork` mode is appropriate;
  do not use cluster mode.
- The process deletes any webhook on startup, then starts long polling with
  `@grammyjs/runner` and `autoRetry`.
- `SIGINT`/`SIGTERM` stop the runner, crons, captcha worker, Postgres and Redis,
  with a 10-second forced-exit timeout.
- Logs are JSON on stdout and daily files under `LOG_DIR`. Keep them machine
  readable.
- Do not add Vercel/serverless configuration. This bot needs a persistent
  process, PostgreSQL and Redis.

## Git and pull requests

- Work on a feature branch; `master` is the integration branch.
- Commit style in this repository is conventional and imperative:
  `feat: ...`, `fix: ...`, `perf: ...`, `docs: ...`, `test: ...`,
  `build: ...`, `style: ...`, `revert: ...`.
- Keep commits focused. Update tests and docs in the same commit when behavior
  changes.
- Before pushing: `bun run verify`, then inspect `git diff`.
- After pushing: confirm CI is green. If CI is green locally but red remotely,
  check the CI Bun version and the lockfile first.
- Pull request descriptions should state the user-visible change, the migration
  requirement and the verification performed.

## Known pitfalls

- **`NaN` in `/stats`**: raw SQL result keys are camelCased by Kysely.
- **Wrong chat/topic**: forum topic IDs come from `message_thread_id`; the
  default topic is the string `"general"`.
- **Private vs group**: daily play is DM-only; group games are serialized per
  chat; rich-message drafts only work in DMs (the project currently does not
  use them).
- **Admin confusion**: `ADMIN_USERS` is the bot owner list; group admins are
  resolved with `getChatMember` and the `requireAdmin` guard.
- **Leaderboard IDs**: only the top 20 rows are returned, so only those rows can
  show IDs.
- **Dates**: daily boundaries use `TIME_ZONE`; leaderboard period boundaries
  are computed in `period-range.helper.ts`. Do not mix local and UTC dates.
- **Removed tooling**: Drizzle and Vercel are not used. Do not reintroduce
  `drizzle.config.ts`, `vercel.json` or `bun.lockb`.
