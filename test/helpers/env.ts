import type IORedis from "ioredis";
import type { Kysely } from "kysely";
import { afterAll, beforeAll, beforeEach } from "bun:test";

import { setRedis } from "#/config/redis";
import type { DB } from "#/database/schema";

import { RedisMock, createRedisMock } from "./redis-mock";
import { type TestDatabase, createTestDatabase } from "./pglite";

export interface TestEnvironment {
  readonly db: Kysely<DB>;
  readonly redis: RedisMock;
}

/**
 * Boots the shared integration environment for a test file: an in-memory
 * Postgres with the real migrations, and an in-memory Redis installed as the
 * process-wide client.
 *
 * Both stores are truncated before every test so files stay independent.
 */
export function setupTestEnvironment(): TestEnvironment {
  let database: TestDatabase | undefined;
  let redis: RedisMock | undefined;

  beforeAll(async () => {
    database = await createTestDatabase();
    redis = new RedisMock();
    setRedis(createRedisMock(redis));
  });

  afterAll(async () => {
    setRedis(null);
    await database?.close();
  });

  beforeEach(async () => {
    await database?.reset();
    redis?.reset();
  });

  return {
    get db() {
      return database!.db;
    },
    get redis() {
      return redis!;
    },
  };
}

export function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export type { IORedis };
