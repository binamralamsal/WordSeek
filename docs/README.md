# WordSeek documentation

Start with the guide that matches what you need:

| Document                           | Use it for                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [../README.md](../README.md)       | What the bot does, commands, quick setup and the environment table.                                            |
| [architecture.md](architecture.md) | How updates flow, feature responsibilities, database tables, Redis keys, background jobs and design decisions. |
| [development.md](development.md)   | Local setup, commands, testing, migrations, deployment, debugging and the pull request checklist.              |
| [../AGENTS.md](../AGENTS.md)       | A condensed map and rule set for AI coding agents.                                                             |

## Quick facts

- Runtime: **Bun 1.4.4**, TypeScript, ESM.
- Bot framework: **grammY**, long polling with `@grammyjs/runner` and
  `autoRetry`.
- Database: **PostgreSQL** through **Kysely**; migrations live in
  `migrations/` and types are generated into `src/database/schema.ts`.
- Cache and ephemeral state: **Redis** through **ioredis**; delayed captcha
  jobs use **BullMQ**.
- Tests: `bun test` with in-memory PostgreSQL (PGlite) and a Redis mock.
- Gate: `bun run verify` = format check, lint, type check and tests.
- Lockfile: text `bun.lock`.
- Deployment: one long-running process per bot token; no serverless/Vercel.

## Common commands

```bash
bun install
bun run db:migrate latest
bun run dev
bun run verify
bun run db:codegen
```
