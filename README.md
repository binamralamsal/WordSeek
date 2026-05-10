# WordSeek
<img width="1173" alt="Group 40 5" src="https://github.com/user-attachments/assets/bf444d36-2eea-4ad5-83e7-4a99acda2bfe" />

## Tech Stack

<p align="left">
  <a href="https://bun.sh"><img src="https://skillicons.dev/icons?i=bun" height="40" alt="bun logo"  /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://skillicons.dev/icons?i=ts" height="40" alt="typescript logo"  /></a>
  <a href="https://grammy.dev/"><img src="https://raw.githubusercontent.com/grammyjs/website/main/logos/grammY.png" height="40" alt="grammy logo"  /></a>
  <a href="https://www.postgresql.org/"><img src="https://skillicons.dev/icons?i=postgres" height="40" alt="postgresql logo"  /></a>
  <a href="https://redis.io/"><img src="https://skillicons.dev/icons?i=redis" height="40" alt="redis logo"  /></a>
  <a href="https://zod.dev/"><img src="https://skillicons.dev/icons?i=zod" height="40" alt="zod logo"  /></a>
</p>

- **[grammY](https://grammy.dev/)** - Telegram Bot Framework
- **[Kysely](https://kysely.dev/)** - Type-safe SQL query builder
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database
- **[Redis](https://redis.io/)** & **[BullMQ](https://docs.bullmq.io/)** - Caching and job queues
- **[Bun.js](https://bun.sh/)** - JavaScript runtime & package manager
- **[Zod](https://zod.dev/)** - Schema validation and type safety

## Features
- Play the Wordle-inspired word guessing game in private chats or group chats.
- Multiple word length modes (4, 5, or 6-letter words).
- Play the **Daily WordSeek** mode in private chats.
- Supports multiplayer gameplay in groups, with advanced admin tools for game management.
- Set up dedicated forum topics for games using Game Topic settings.
- Keep track of scores with group and global leaderboards.
- Commands to view personal scores and leaderboard rankings filtered by time (today, week, month, etc.).
- Flexible game settings: customizable limits for attempts and group admin permissions.

## How to Play
1. **Start a game**: Use the `/new` command in a group or private chat.
2. **Guess the word**: Players try to guess a random hidden word.
3. **Hints after each guess**:
   - 🟩 - Correct letter in the right spot.
   - 🟨 - Correct letter in the wrong spot.
   - 🟥 - Letter not in the word.
4. The game ends when:
   - The word is correctly guessed, or
   - Maximum number of guesses (30) is reached.
5. The first person to guess the word correctly wins!

## Commands

### Basic Commands
- **/new** - Start a new game (default 5 letters).
- **/new4** - Start a 4-letter game.
- **/new5** - Start a 5-letter game.
- **/new6** - Start a 6-letter game.
- **/end** - End the current game (voting or admin only).
- **/help** - Show the help menu.
- **/daily** - Play Daily WordSeek (private chat only).
- **/pausedaily** - Pause Daily mode and go back to normal games.

### Leaderboard & Scores
- **/leaderboard** - View leaderboards. Syntax: `/leaderboard [scope] [period] [length]`
  Example: `/leaderboard global week 6`
- **/score** - View your score or someone else's. Syntax: `/score [target] [scope] [period] [length]`
  Example: `/score @username global all 4`

### Group Settings (Admin Only)
- **/seekauth** - Manage users who can end games without a vote.
- **/setgametopic** - Restrict games to specific topics (in forum groups).
- **/unsetgametopic** - Remove topic restriction.
- **/allowonlylen** - Restrict allowed word lengths in a topic (e.g., `/allowonlylen 5 6`).
- **/recreatetopic** - Auto-recreate topic when it expires.

### Bot Admin Commands (Owner Only)
- **/ban** & **/unban** - Manage user bans globally.
- **/stats** - View bot usage statistics.
- **/transfer** - Transfer scores between users.
- **/broadcast** - Broadcast a message to all chats.
- **/track**, **/untrack**, **/tracklist** - Manage tracking for chats (to detect cheaters).

## Deployment

### Deploy to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/binamralamsal/WordSeek)

If you prefer to deploy manually using the Heroku CLI:

1. Clone this repository and navigate to the directory:
   ```bash
   git clone https://github.com/binamralamsal/WordSeek
   cd WordSeek
   ```
2. Login to Heroku and create a new container-based app:
   ```bash
   heroku login
   heroku create your-app-name --manifest
   ```
3. Provision the required PostgreSQL and Redis add-ons:
   ```bash
   heroku addons:create heroku-postgresql:mini
   heroku addons:create heroku-redis:mini
   ```
4. Set the necessary environment variables:
   ```bash
   heroku config:set BOT_TOKEN=your_bot_token
   heroku config:set DAILY_WORDLE_SECRET=your_random_secret_string
   heroku config:set NODE_ENV=production
   heroku config:set UPDATES_CHANNEL=https://t.me/YourChannel
   heroku config:set DISCUSSION_GROUP=https://t.me/YourGroup
   # Ensure REDIS_URI matches the provided REDIS_URL from the add-on
   heroku config:set REDIS_URI=$(heroku config:get REDIS_URL)
   ```
5. Deploy the application:
   ```bash
   git push heroku main
   ```
6. Scale the worker dyno to start the bot:
   ```bash
   heroku ps:scale worker=1
   ```

### Deploy using Docker

1. **Build the Docker image**:
   ```bash
   docker build -t wordseek-bot .
   ```

2. **Run the container**:
   Ensure you have PostgreSQL and Redis running, then run the container with your environment variables:
   ```bash
   docker run -d \
     --name wordseek \
     -e BOT_TOKEN=your_bot_token \
     -e DATABASE_URL=postgresql://user:pass@host:5432/db \
     -e REDIS_URI=redis://host:6379 \
     -e DAILY_WORDLE_SECRET=your_secret \
     -e ADMIN_USERS=your_id \
     wordseek-bot
   ```

   *Note: If running databases in other containers, ensure they are on the same network or use the appropriate host address.*

## Installation & Setup

### Requirements
- Bun.js Runtime (or Node.js)
- Telegram Bot Token (create one via [BotFather](https://core.telegram.org/bots#botfather))
- PostgreSQL database
- Redis server (for caching, session management, and job queues)

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
   DAILY_WORDLE_SECRET=your-random-secret-string
   NODE_ENV=development
   REDIS_URI=redis://127.0.0.1:6379
   ADMIN_USERS=your-telegram-user-id
   TIME_ZONE=UTC
   UPDATES_CHANNEL=https://t.me/YourChannel
   DISCUSSION_GROUP=https://t.me/YourGroup
   ```

4. **Set up the database**:
   Run the database migrations to set up the required tables:
   ```bash
   bun run db:migrate
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

### Additional Database Commands
- **Seed the database**:
  ```bash
  bun run db:seed
  ```
- **Generate types for database schemas**:
  ```bash
  bun run db:codegen
  ```


## Try the Bot
- **[WordSeek I](https://t.me/WordSeekBot)** *(Main bot)*
- **[WordSeek II](https://t.me/WordSeek2Bot)** *(Use this if the main bot is busy)*

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
