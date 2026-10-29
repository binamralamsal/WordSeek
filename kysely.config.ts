import { Pool } from "pg";
import { defineConfig } from "kysely-ctl";
import {
  CamelCasePlugin,
  DeduplicateJoinsPlugin,
  PostgresDialect,
} from "kysely";

import { env } from "./src/config/env";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
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
