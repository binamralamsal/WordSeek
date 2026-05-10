import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  PostgresDialect,
} from "kysely";
import { defineConfig } from "kysely-ctl";
import { Pool } from "pg";

import { env } from "./src/config/env";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    ssl:
      env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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
