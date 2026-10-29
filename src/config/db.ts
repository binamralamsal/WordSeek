import pg from "pg";
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PostgresDialect,
} from "kysely";

import type { DB } from "#/database/schema";

import { createLogger } from "#/core/logging/logger.service";

import { env } from "./env";

const log = createLogger("database");

const { Pool } = pg;

function createDatabase(): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: env.DATABASE_URL,
        max: 10,
      }),
    }),
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
}

let activeDatabase: Kysely<DB> | null = null;

function currentDatabase(): Kysely<DB> {
  // Lazily create the production pool so importing this module (for example in
  // tests) never opens a real connection unless it is actually used.
  activeDatabase ??= createDatabase();
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
