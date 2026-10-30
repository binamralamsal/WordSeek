import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PostgresDialect,
} from "kysely";
import pg from "pg";

import { createLogger } from "#/core/logging/logger.service";
import type { DB } from "#/database/schema";

import { env } from "./env";

const log = createLogger("database");

const { Pool } = pg;

interface DatabaseHandle {
  database: Kysely<DB>;
  pool: pg.Pool;
}

function createDatabase(): DatabaseHandle {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

  // Without a listener, an error on an idle pool client (for example a
  // database restart) is an unhandled "error" event and crashes the process.
  pool.on("error", (error) => {
    log.error({ err: error }, "Idle PostgreSQL client error");
  });

  const database = new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    log: (event) => {
      if (event.level === "query") {
        if (env.NODE_ENV === "development") {
          log.debug(
            { sql: event.query.sql, parameters: event.query.parameters },
            "SQL query",
          );
        }
        return;
      }

      log.error({ err: event.error }, "Database error");
    },
    plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
  });

  return { database, pool };
}

let activeDatabase: Kysely<DB> | null = null;
let activePool: pg.Pool | null = null;

function currentDatabase(): Kysely<DB> {
  // Lazily create the production pool so importing this module (for example in
  // tests) never opens a real connection unless it is actually used.
  if (!activeDatabase) {
    const handle = createDatabase();
    activeDatabase = handle.database;
    activePool = handle.pool;
  }
  return activeDatabase;
}

/**
 * Proxy around the active Kysely instance.
 *
 * Using a proxy keeps every existing `db.selectFrom(...)` call typed and
 * untouched while allowing tests to swap in an in-memory PGlite database via
 * `setDatabase`.
 */
export const db: Kysely<DB> = new Proxy({} as Kysely<DB>, {
  get(_target, property) {
    const database = currentDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
  set(_target, property, value) {
    return Reflect.set(currentDatabase(), property, value);
  },
  has(_target, property) {
    return property in currentDatabase();
  },
});

export function setDatabase(database: Kysely<DB> | null): void {
  activeDatabase = database;
}

export function getDatabase(): Kysely<DB> {
  return currentDatabase();
}

/**
 * Closes the database during shutdown. Does not open a connection when none was
 * ever created, so it is safe to call from a partially started process.
 */
export async function closeDatabase(): Promise<void> {
  const database = activeDatabase;
  const pool = activePool;

  activeDatabase = null;
  activePool = null;

  if (database) {
    await database.destroy();
    return;
  }

  await pool?.end();
}
