import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  Kysely,
  PostgresDialect,
} from "kysely";
import pg from "pg";

import type { DB } from "../database-schemas";
import { env } from "./env";

const { Pool } = pg;

// treats as `verify-full`, overriding any ssl option we pass. Strip it from the URL
// so our explicit ssl config is the only one pg sees.
function getDbConnectionString() {
  try {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return env.DATABASE_URL;
  }
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: getDbConnectionString(),
    max: 10,
    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  }),
});

export const db = new Kysely<DB>({
  dialect,
  log: (event) => {
    if (env.NODE_ENV === "development") {
      if (event.level === "query") {
        console.log("SQL:", event.query.sql);
        console.log("Parameters:", event.query.parameters);
      } else {
        console.error("Error:", event.error);
      }
      console.log("-------------");
    }
  },
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});
