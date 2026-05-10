import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  PostgresDialect,
} from "kysely";
import { defineConfig } from "kysely-ctl";
import { Pool } from "pg";

import { env } from "./src/config/env";

// Strip sslmode from DATABASE_URL so pg-connection-string doesn't
// override our explicit ssl option with verify-full semantics.
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

export default defineConfig({
  dialect,
  migrations: {
    migrationFolder: "migrations",
  },
  seeds: {
    seedFolder: "seeds",
  },
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});
