# Architecture

This document explains how WordSeek is put together and why. For commands,
setup and workflows, see [development.md](development.md). For the short
agent-facing checklist, see [AGENTS.md](../AGENTS.md).

## Runtime overview

WordSeek is **one long-running Bun process** per Telegram bot token. It runs the
Telegram poller, the Mini App HTTP server, scheduled jobs and the captcha worker
together. It has no serverless entry point.

```
Telegram Bot API
      │  long polling (grammY runner + autoRetry)
      ▼
  bot.use(createAppComposer())
      │
      ├─ middleware pipeline (sync, tracking, bans, sequencing)
      ├─ command router ──► feature commands
      ├─ callback router ─► feature callbacks
      └─ text handler ────► regular/daily guesses
      ▲
      │ Telegram Mini App
      └─ Bun.serve ──► Elysia API + built React frontend
      │
      ├─ PostgreSQL (Kysely + pg)  ── users, games, scores, daily words
      ├─ Redis (ioredis)          ── sessions, votes, tracking, broadcast state
      ├─ BullMQ worker            ── delayed captcha expiry
      ├─ cron jobs                ── daily word, leaderboard compaction
      └─ logs                     ── stdout JSON + daily files + system channel
```

The process starts in `src/index.ts`:

1. Install `autoRetry` on the Telegram API client.
2. Mount `createAppComposer()` and the global error handler.
3. Start the daily-word cron, compaction cron and captcha worker.
4. Ensure today's daily word exists.
5. Delete any webhook with pending updates.
6. Start the Mini App HTTP server and configure its Telegram menu button.
7. Start long polling, sync the advertised command menu and resume any
   interrupted broadcast.

`SIGINT`/`SIGTERM` stop the runner, crons and worker, close Postgres and Redis,
and force-exit after 10 seconds. Only one process may poll a token; running two
causes lost and duplicated updates.

## Update pipeline

`src/app.ts` is the single source of truth for the middleware order. Both
production and integration tests mount it.

| Order | Middleware                | Purpose                                                                                                       |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1     | `syncUserChatMiddleware`  | Upserts `users` and `broadcast_chats`; fire-and-forget so polling is not blocked.                             |
| 2     | `topicEditedMiddleware`   | Keeps stored forum-topic metadata in sync.                                                                    |
| 3     | `trackMessagesMiddleware` | Detects known cheating clients, alerts `LOGS_CHANNEL`/admins, forwards tracked chats, counts greeting combos. |
| 4     | `sequentialize(...)`      | Serializes updates per group chat ID. Private chats and callback queries bypass it for latency.               |
| 5     | `bannedUsersMiddleware`   | Blocks banned users. Replies only in DM or when the bot is mentioned, to avoid group spam.                    |
| 6     | `commandRouter`           | Slash commands.                                                                                               |
| 7     | `callbackRouter`          | Inline-button callbacks, ending with a catch-all `answerCallbackQuery`.                                       |
| 8     | `wordleTextHandler`       | Plain 4–6 letter guesses.                                                                                     |
| 9     | `botMembershipMiddleware` | Handles the bot being added to or removed from a chat.                                                        |

Order is behavior. A new cross-cutting middleware belongs in `app.ts`. A new
command belongs in `commandRouter`; a new callback family belongs in
`callbackRouter` before the catch-all.

## Module layout

```
src/
├── index.ts        process lifecycle and background jobs
├── app.ts          root middleware stack
├── config/         env schema, bot, lazy database/Redis proxies, constants
├── core/           cross-feature code
│   ├── database/   PostgreSQL error classification
│   ├── format/     HTML escaping, mentions, durations, word details
│   ├── guards/     group-admin guard and guard runner
│   ├── logging/    pino setup, daily file stream, system-log channel
│   ├── middleware/ update pipeline middleware and global error handler
│   ├── services/   command registry and user lookups
│   ├── telegram/   rich-message keyboard, notices, edit helpers
│   └── ui/         shared community keyboard/footer
├── database/       generated Kysely schema
├── features/       user-facing features, one folder each
├── types/          shared domain constants and types
└── data/           word lists, common words, banner image
```

`src/config/db.ts` and `src/config/redis.ts` export proxies around lazily
created clients. Importing them never opens a socket; tests replace the active
client with `setDatabase` / `setRedis`. This keeps command modules free of
connection side effects.

## Features

### Regular WordSeek

Files live in `src/features/wordle/regular/`.

- `/new`, `/new4`, `/new5`, `/new6` call `startGame`.
- Guards require an allowed forum topic and no active daily session.
- Per-topic settings in `chat_game_topics` can restrict allowed lengths.
- A game is a row in `games`: `active_chat` is unique, and `topic_id`
  distinguishes forum topics. This prevents two games in one chat/topic.
- A valid guess is stored in `guesses` (`game_id`, `chat_id`, unique per chat
  word). Duplicate guesses are rejected before the insert.
- A correct guess scores `30 - number_of_guesses_so_far` and inserts a
  `leaderboard` row with the chat, user, word length and score.
- `/end` permits the starter, a group admin, or a successful vote. Votes live in
  Redis with a five-minute TTL.

### WordSeek of the Day

Files live in `src/features/wordle/daily/`.

- `/daily` is DM-only and refuses to start while a regular game is active.
- `ensureDailyWordExists` creates the `daily_words` row if needed.
- The word is selected by a deterministic shuffle seeded from
  `DAILY_WORDLE_SECRET` and the number of days since `DAILY_WORDLE_START_DATE`.
  The same date therefore always produces the same word.
- Word meaning, phonetic and example sentence are generated with Gemini using
  `GEMINI_API_KEYS`. Failures rotate keys/models with cooldowns stored in Redis;
  generation is best-effort and the word still works without details.
- An active session is stored in Redis (`daily_wordle:<userId>`) with a
  one-day TTL. Guesses are stored in `daily_guesses`.
- Players get six attempts. Streaks live in `user_stats` and are reset for
  inactive players when the next daily word is generated.
- `/pausedaily` clears the Redis session so regular play is allowed; attempts
  remain in the database and still count when the player returns.

### Scores and leaderboards

Files live in `src/features/scores/`.

- `/leaderboard` and `/score` accept filters: scope (`global`/`group`), period
  (`today`/`week`/`month`/`year`/`all`) and word length (`4`/`5`/`6`).
- `parse-filters.helper.ts` parses free-form command arguments.
- `period-range.helper.ts` turns a period into a half-open timestamp range.
- `get-leaderboard-scores.service.ts` aggregates `leaderboard` rows first, then
  joins `users` for only the top 20. Banned users are excluded in the aggregate.
- Only those 20 rows can display Telegram IDs. `/leaderboard` shows every
  displayed player's ID only when the requester is in `ADMIN_USERS` **and** the
  chat is private. Groups and non-admin DMs never show IDs.
- The current period defaults differ by chat type: DMs default to global;
  groups default to a group view.

Leaderboard history is compacted nightly. `leaderboard-compaction.service.ts`
collapses rows that every filter treats identically, leaving the current month
row-by-row. A transaction-scoped advisory lock makes overlapping runs a no-op.
The invariant is: compaction must not change any today/week/month/year/all
total.

### Admin tools

Files live in `src/features/admin/`.

- **Bans**: `/ban` and `/unban` write `banned_users`; the middleware enforces
  them for every message.
- **Tracking**: `/track` stores a chat-to-admin mapping in Redis; the tracking
  middleware forwards updates. `/tracklist` lists tracked chats.
- **Transfer**: moves a user's leaderboard rows between users.
- **Stats**: `/stats` is restricted to `ADMIN_USERS`. It reads process and OS
  metrics, plus one aggregate query for users, active players, active groups and
  total groups. It relies on `leaderboard_chat_id_idx`.
- **Broadcast**: `/broadcast` replies to a message, copies it to every
  `broadcast_chats` row, persists progress in Redis and resumes on restart.
  `/broadcast_status` and `/broadcast_cancel` inspect/cancel it. A Redis lock
  prevents concurrent broadcasts.
- **Captcha**: `/captcha` sends a slot-machine challenge in a group and delays
  a BullMQ job by 60 seconds; if the challenge is still unsolved, the expiry
  worker marks it timed out and notifies the admin. Three wrong attempts also
  fail the challenge.

### Group settings

Files live in `src/features/group-settings/`.

- `setgametopic` registers the current forum topic for play; `unsetgametopic`
  removes it.
- `allowonlylen` restricts the word lengths allowed in a topic.
- `recreatetopic` toggles whether an expired topic is recreated automatically.
- `seekauth` manages users authorized to end games.

The game guards consult these tables and reject play outside designated topics.

### General and help

- `/start` sends a rich welcome with a banner and community buttons, falling
  back to a plain photo message if rich media upload fails.
- `/id` inspects the replied-to message.
- `/score` is also exposed through `my-score.command.ts` for the legacy path.
- `/help` uses rich messages and callback buttons; message content lives in
  `features/help/helpers/messages.helper.ts`.

## Data model

The Kysely schema is generated into `src/database/schema.ts` by
`bun run db:codegen`. Do not hand-edit it.

| Table              | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `users`            | Telegram identity, plus Mini App nickname and photo.                |
| `leaderboard`      | One row per scoring win: chat, user, word length, score, timestamp. |
| `games`            | Shared bot/Mini App games, identified by enum source and scope.     |
| `guesses`          | Ordered guesses per game; `created_at` supplies attempt order.      |
| `daily_words`      | One row per date: word, meaning, phonetic, sentence, day number.    |
| `daily_guesses`    | Daily attempts per user and daily word.                             |
| `user_stats`       | Daily streaks/results and classic wins per user.                    |
| `banned_users`     | Users blocked from using the bot.                                   |
| `authorized_users` | Per-chat users allowed to end games.                                |
| `chat_game_topics` | Forum topics registered for play and their settings.                |
| `broadcast_chats`  | Chats/groups the bot can broadcast to.                              |

Conventions:

- Telegram IDs are stored as strings.
- `word_length` is stored as the string `"4"`, `"5"` or `"6"`.
- `games.source` is the `game_source` enum (`telegram` or `miniapp`). The
  Mini App uses a player-specific `active_chat` scope and a word-length topic,
  while the bot continues to use its existing chat/topic scope.
- Classic score remains in `leaderboard`; classic guess count is derived from
  `guesses`. `user_stats.classic_games_won` is the historical win baseline
  estimated from compacted leaderboard scores and then incremented on each
  classic win.
- Group chat IDs start with `-1`; private chat IDs do not. `/stats` uses this to
  classify active chats.
- Timestamps are `timestamptz`, with `created_at`/`updated_at` defaults and
  update triggers where needed.
- Kysely is configured with `CamelCasePlugin` and `DeduplicateJoinsPlugin`. Use
  camelCase in query-builder code. **Raw SQL results are camelCased too**, so
  read `totalUsers`, not `total_users`.

Indexes are critical on `leaderboard`:

- `(word_length, chat_id, created_at, user_id, score)` for group leaderboards.
- `(word_length, created_at, user_id, score)` for global leaderboards.
- `(user_id, word_length, chat_id, created_at)` for smart `/score` defaults.
- `(chat_id)` for `/stats` distinct-chat scans.

When adding a filter, verify an index can support it and explain the index in
the migration.

## Redis state

Key builders are centralized in `src/core/redis-keys.constants.ts`.

| Key                                      | Meaning                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `vote:<chatId>`                          | Active vote to end a regular game (TTL 5 minutes). |
| `daily_wordle:<userId>`                  | Active daily session (TTL 24 hours).               |
| `captcha:<chatId>:<userId>`              | Pending captcha challenge.                         |
| `h:<chatId>:<length>`                    | Recent word history to avoid repeats.              |
| `tracking:<chatId>`                      | Admin chat receiving forwarded updates.            |
| `greetingTrack:<userId>:<phrase>:<date>` | Anti-spam greeting counters.                       |
| `seek-gemini:failed_keys`                | Gemini key cooldowns.                              |
| `broadcast:state`                        | JSON progress of a running broadcast.              |
| `broadcast:lock`                         | Broadcast mutual exclusion.                        |

Redis is also the BullMQ connection for captcha jobs. Do not create ad-hoc key
strings; add a builder.

## Background jobs

| Job                    | Schedule/trigger             | Entry point                                      |
| ---------------------- | ---------------------------- | ------------------------------------------------ |
| Daily word generation  | `0 6 * * *` in `TIME_ZONE`   | `features/wordle/daily/daily.cron.ts`            |
| Streak reset           | With daily word generation   | `daily-word.service.ts`                          |
| Leaderboard compaction | `15 0 * * *` in `TIME_ZONE`  | `features/scores/leaderboard-compaction.cron.ts` |
| Captcha expiry         | 60-second delayed BullMQ job | `captcha-queue.service.ts`                       |
| Broadcast resume       | Once at startup              | `broadcast.service.ts`                           |

Crons are `cron` jobs with `start: false`; `src/index.ts` starts and stops them.
The BullMQ worker is created once and closed during shutdown.

## UI and formatting

WordSeek uses Telegram **rich messages** (`replyWithRichMessage`) for most
user-facing output. Rich messages carry HTML-like headings, paragraphs,
blockquotes, tables and buttons in the body.

- `renderInlineKeyboard` converts a grammY `InlineKeyboard` into rich
  `<tg-button-row>` markup. Append it to the HTML; do not pass `reply_markup`.
- `replyNotice` sends a short escaped blockquote for one-line errors/notices.
- `escapeHtml` must wrap user-controlled text (names, usernames, guesses).
- The regular game board is generated as an image with Satori (JSX in
  `image.helper.tsx`) and Sharp, then sent with a caption.
- `/start` uploads `src/data/banner.png` and falls back to a plain photo if
  rich media is unavailable.

Keep private/group behavior explicit. Daily play is DM-only, leaderboard IDs
are DM-and-admin-only, and rich-message drafts are not used.

## Errors, logging and anti-cheat

- `bot.catch(errorHandler)` logs the update context, then handles known cases:
  missing send rights (leave the chat), expired forum topic (recreate it if
  enabled), Telegram HTTP failures and unexpected errors.
- `reportSystemLog` sends important failures to `SYSTEM_LOG_CHANNEL`, with a
  60-second dedupe window and a serialized queue. It never uses `LOGS_CHANNEL`.
- Pino writes newline-delimited JSON to stdout and, outside tests, to daily
  files (`wordseek-YYYY-MM-DD.log`) with retention.
- `trackMessagesMiddleware` matches known auto-play/cheat client strings, sends
  alerts and forwarded messages to `LOGS_CHANNEL` (or admins), and forwards all
  updates for explicitly tracked chats.

## Concurrency and consistency

- Group updates are serialized per chat to preserve game ordering. Private
  chats and callbacks are not, to keep interactions snappy.
- `games.active_chat` is unique, preventing duplicate active games.
- User and chat sync use upserts and do not block the update.
- Duplicate-key errors are treated as expected in a few flows and not logged as
  errors.
- Compaction uses `pg_try_advisory_xact_lock`; overlapping cron + manual runs
  skip instead of conflicting.
- Broadcast state is persisted after every chat, so a restart resumes rather
  than restarts.
- Captcha expiry re-checks Redis before marking a challenge timed out, so a
  solved challenge is a no-op.

## Performance notes

- Leaderboards aggregate before joining `users`, limiting the join to 20 rows.
- `/stats` counts active players/groups in one leaderboard scan and fetches all
  four totals in one round trip.
- `leaderboard(chat_id)` makes the distinct-chat scan index-only.
- Redis is used for hot ephemeral state; Postgres remains the source of truth for
  scores, games and daily words.
- The daily word is generated once per date and cached in `daily_words`.

## Security and privacy

- `ADMIN_USERS` (bot admins) and group admins are different concepts. Bot-admin
  checks use `env.ADMIN_USERS`; group checks use `requireAdmin` and Telegram's
  `getChatMember`.
- Banned users are blocked before commands run.
- User-controlled text is HTML-escaped before rich messages.
- AI-generated meanings are sanitized to allow only `<b>`, `<i>` and `<u>`.
- Secrets come from the environment; `.env` is ignored. Never log tokens or
  API keys.
- Telegram user IDs are only revealed on leaderboards in admin DMs.

## Extending the system

- **New command**: add `features/<area>/<name>.command.ts`, register it in
  `command-router.ts`, add it to `advertisedCommands` if public, and cover it in
  `test/integration`.
- **New callback**: add `*.callback.ts`, register it in `callback-router.ts`
  before the catch-all, and test the button payload.
- **New table/column**: add a timestamped migration, run it locally, regenerate
  `src/database/schema.ts`, update services and tests.
- **New Redis state**: add a builder to `redis-keys.constants.ts`.
- **New cron/worker**: add it under the feature, start/stop it in `index.ts`,
  and make shutdown safe.
- **New env var**: extend `src/config/env.ts`, `.env.example`, the README table,
  this doc where relevant, and `test/setup.ts` if tests import the config.
