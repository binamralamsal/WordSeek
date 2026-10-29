import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  type Migration,
  type MigrationProvider,
  Migrator,
} from "kysely/migration";
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PGliteDialect,
  sql,
} from "kysely";

import { setDatabase } from "#/config/db";
import type { DB } from "#/database/schema";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

class FileMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".ts"))
      .sort();

    const migrations: Record<string, Migration> = {};

    for (const file of files) {
      const module = await import(
        pathToFileURL(path.join(MIGRATIONS_DIR, file)).href
      );
      migrations[file.replace(/\.ts$/, "")] = {
        up: module.up,
        down: module.down,
      };
    }

    return migrations;
  }
}

const APP_TABLES = [
  "daily_guesses",
  "guesses",
  "daily_words",
  "games",
  "leaderboard",
  "banned_users",
  "authorized_users",
  "chat_game_topics",
  "broadcast_chats",
  "user_stats",
  "users",
] as const;

export interface TestDatabase {
  db: Kysely<DB>;
  pglite: PGlite;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Boots an in-memory Postgres (PGlite) and runs the real project migrations,
 * then registers it as the process-wide `db`.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const pglite = new PGlite();
  const db = new Kysely<DB>({
    dialect: new PGliteDialect({ pglite }),
    plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  if (error) {
    throw error;
  }

  if (!results?.length) {
    throw new Error("No migrations were applied");
  }

  setDatabase(db);

  const reset = async () => {
    const tables = sql.join(APP_TABLES.map((table) => sql.id(table)));
    await sql`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`.execute(db);
  };

  const close = async () => {
    setDatabase(null);
    await db.destroy();
  };

  return { db, pglite, reset, close };
}
