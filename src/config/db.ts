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

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  }),
});

export const db = new Kysely<DB>({
  dialect,
  log: (event) => {
    if (event.level === "query") {
      console.log("SQL:", event.query.sql);
      console.log("Parameters:", event.query.parameters);
    } else {
      console.error("Error:", event.error);
    }
    console.log("-------------");
  },
  plugins: [new CamelCasePlugin(), new DeduplicateJoinsPlugin()],
});
