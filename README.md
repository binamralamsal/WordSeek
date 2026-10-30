# WordSeek

[![CI](https://github.com/binamralamsal/WordSeek/actions/workflows/ci.yml/badge.svg)](https://github.com/binamralamsal/WordSeek/actions/workflows/ci.yml)

<img width="1173" alt="Group 40 5" src="https://github.com/user-attachments/assets/bf444d36-2eea-4ad5-83e7-4a99acda2bfe" />

## Features

- Play the Wordle-inspired word guessing game in private chats or group chats.
- Supports multiplayer gameplay in groups, with admin tools for game management.
- Keep track of scores with group and global leaderboards.
- Commands to view personal scores and leaderboard rankings filtered by time (today, week, month, etc.).
- Flexible game settings: customizable limits for attempts and group admin permissions.

## How to Play

1. **Start a game**: Use the `/new` command in a group or private chat.
2. **Guess the word**: Players try to guess a random 5-letter word.
3. **Hints after each guess**:
   - 🟩 - Correct letter in the right spot.
   - 🟨 - Correct letter in the wrong spot.
   - 🟥 - Letter not in the word.
4. The game ends when:
   - The word is correctly guessed, or
   - Maximum number of guesses (30) is reached.
5. The first person to guess the word correctly wins!

## Commands

- **/new** - Start a new game.
- **/end** - End the current game (admins only in group chats).
- **/help** - Get help with commands and game rules.
- **/leaderboard** - View leaderboards for the group or globally. Example:
  ```
  /leaderboard global week
  ```
- **/score** - View your score. Example:
  ```
  /score group all
  /score @username group
  ```
- **/stats** - View bot usage stats (admin users only).

## Installation & Setup

### Requirements

- Bun.js Runtime (or Node.js)
- Telegram Bot Token (create one via [BotFather](https://core.telegram.org/bots#botfather))
- PostgreSQL database
- Redis server (for caching and session management)

### Steps

1. **Clone the repository**:

   ```bash
   git clone https://github.com/binamralamsal/WordSeek
   cd WordSeek
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory with the following variables:

   ```env
   BOT_TOKEN=your-telegram-bot-token
   DATABASE_URL=your-postgresql-database-url
   NODE_ENV=development
   REDIS_URI=redis://127.0.0.1:6379
   ```

4. **Set up the database**:
   Run the database migrations to set up the required tables:

   ```bash
   bun run db:migrate latest
   ```

5. **Start the bot**:
   - **Development mode** (with hot reload):
     ```bash
     bun run dev
     ```
   - **Production mode**:
     ```bash
     bun run start
     ```

Only one bot process can poll a Telegram bot token at a time. On startup the
bot takes a Redis lease (`wordseek:instance-lock`) and exits with a clear error
if another instance already holds it. `SIGINT`/`SIGTERM` stop the update
runner, the cron job and the captcha worker, then close Postgres and Redis
before exiting.

### Additional Database Commands

- **Create new migrations** (after schema changes):
  ```bash
  bun run db:migrate make migration-name
  ```
- **Compact leaderboard history** (runs automatically every day at 00:15, or
  manually after a large import):
  ```bash
  bun run db:compact
  ```
  Only rows older than the current month are merged, per user, chat, word
  length and filter bucket. The current month is kept row by row, so recent
  score history stays visible. The today/week/month/year/all totals are
  unchanged.

## Environment Variables

| Variable              | Description                                             | Example                                              |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| `BOT_TOKEN`           | Your Telegram bot token from BotFather                  | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`               |
| `DATABASE_URL`        | PostgreSQL connection string                            | `postgresql://user:password@localhost:5432/wordseek` |
| `NODE_ENV`            | Environment mode                                        | `development`, `production` or `test`                |
| `REDIS_URI`           | Redis connection string                                 | `redis://127.0.0.1:6379`                             |
| `ADMIN_USERS`         | Comma-separated Telegram user IDs with bot-admin rights | `123456789,987654321`                                |
| `TIME_ZONE`           | Timezone used for the daily reset                       | `Asia/Kathmandu`                                     |
| `DAILY_WORDLE_SECRET` | Secret used to derive the daily word order              | `change-me`                                          |
| `LOGS_CHANNEL`        | Anti-cheat channel for suspicious messages only         | `-1001234567890`                                     |
| `SYSTEM_LOG_CHANNEL`  | Separate channel for unexpected system errors           | `-1009876543210`                                     |
| `LOG_LEVEL`           | Minimum log level (`fatal` … `silent`)                  | `info`                                               |
| `LOG_DIR`             | Directory for daily log files                           | `logs`                                               |
| `LOG_RETENTION_DAYS`  | Days of daily log files to keep                         | `14`                                                 |
| `LOG_TO_FILE`         | Write daily log files in addition to stdout             | `true` or `false`                                    |

`LOGS_CHANNEL` and `SYSTEM_LOG_CHANNEL` serve different purposes and must not
point at the same chat: the former tracks cheaters, the latter reports crashes.

## Development

Formatting, linting and type checking all run through Bun's built-in tools, so
there is nothing to install. Their configuration lives in `bunfig.toml`.

```bash
bun fmt                # format the repository
bun fmt --check        # fail if anything needs formatting
bun lint               # lint (warnings do not fail)
bun lint --fix         # apply safe autofixes
bun lint --type-aware  # extra type-aware rules (opt-in, currently noisy)
bun check              # type check with `bun check` (replaces `tsc --noEmit`)
bun run verify         # fmt:check + lint + typecheck + tests
```

Import order is enforced by `bun fmt` (`[fmt.sortImports]` in `bunfig.toml`):
`grammy`, `@grammyjs/*`, built-ins and packages, `#/*` aliases, then relative
paths. Each group is sorted alphabetically.

CI (`.github/workflows/ci.yml`) runs `bun run verify` on every push to `master`
and on every pull request, using the Bun version pinned in `.bun-version`.

## Testing

The test suite uses `bun test` with an in-memory Postgres (PGlite running the
real migrations) and an in-memory Redis mock, so no external services are
needed.

```bash
bun test              # run everything
bun test:watch        # watch mode
bun test:coverage     # coverage report
bun test --check      # type check the tests first
bun run typecheck     # type check the whole project
bun test test/integration/scores.test.ts   # a single file
```

Tests live in `test/unit` and `test/integration`. Integration tests mount the
real grammY middleware stack and assert on the exact Telegram API calls the bot
would make.

## Project Structure

```
src/
├── app.ts                 # root middleware stack
├── config/                # env, bot, database, redis, constants
├── core/                  # cross-feature helpers, guards, logging, middleware
├── features/
│   ├── admin/             # ban, captcha, stats, track, transfer, broadcast
│   ├── general/           # start, help-adjacent, id, myscore
│   ├── group-settings/    # game topics, allowed lengths, seek auth
│   ├── help/              # help command, callbacks and messages
│   ├── scores/            # /score and /leaderboard
│   └── wordle/
│       ├── daily/         # WordSeek of the Day
│       ├── regular/       # group/private games
│       └── shared/        # board, hints, images, guards, types
└── index.ts               # process bootstrap
```

Files use role-based suffixes: `.command.ts`, `.callback.ts`, `.handler.ts`,
`.middleware.ts`, `.service.ts`, `.helper.ts`, `.guard.ts`, `.schema.ts`,
`.constants.ts`, `.cron.ts` and `.stream.ts`.

## Technologies Used

- **[grammy](https://grammy.dev/)**: Telegram Bot API framework.
- **Drizzle ORM**: Simplified database queries and migrations.
- **PostgreSQL**: Persistent storage for game data and leaderboards.
- **Redis**: Caching and session management.
- **Bun.js**: Blazing fast JavaScript runtime and package manager.
- **Zod**: Schema validation and type safety.

## Try the Bot

- **[WordSeek I](https://t.me/WordSeekBot)** _(Main bot)_
- **[WordSeek II](https://t.me/WordSeek2Bot)** _(Use this if the main bot is busy)_

## Community

- **Join the Official Group**: [Word Guesser Group](https://t.me/wordguesser) - Play the game, discuss strategies, and share feedback.
- **Support the Developer**: [Binamra Bots Channel](https://t.me/BinamraBots)
- **Contact the Developer**: Have suggestions or issues? Reach out on Telegram: [@binamralamsal](https://t.me/binamralamsal)

## Contributing

We welcome contributions to enhance the bot! Here's how you can help:

1. **Fork the repository** on GitHub.
2. **Create a new branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and ensure they follow the project's coding standards.
4. **Test your changes** thoroughly in development mode.
5. **Commit your changes** with descriptive commit messages:
   ```bash
   git commit -m "Add: new feature description"
   ```
6. **Push to your fork** and **open a pull request** with a clear description of your changes.

### Development Guidelines

- Follow the existing code style and structure.
- Add appropriate error handling for new features.
- Update documentation for any new commands or features.
- Test both private chat and group chat functionality.

## Troubleshooting

### Common Issues

- **Database connection errors**: Ensure PostgreSQL is running and the `DATABASE_URL` is correct.
- **Redis connection errors**: Make sure Redis server is running on the specified port.
- **Bot not responding**: Verify your `BOT_TOKEN` is valid and the bot is not already running elsewhere.
- **Migration errors**: Ensure you have proper database permissions and the database exists.

### Getting Help

If you encounter issues:

1. Check the [Issues](https://github.com/binamralamsal/WordSeek/issues) page on GitHub.
2. Join the [Word Guesser Group](https://t.me/wordguesser) for community support.
3. Contact the developer directly: [@binamralamsal](https://t.me/binamralamsal)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
