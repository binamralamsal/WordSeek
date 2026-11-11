import IORedis from "ioredis";

import { createLogger } from "#/core/logging/logger.service";

import { env } from "./env";

const log = createLogger("redis");

type RedisClient = IORedis;

let activeRedis: RedisClient | null = null;

const ERROR_LOG_INTERVAL_MS = 30_000;
let lastErrorLogAt = 0;
let suppressedErrors = 0;

/**
 * ioredis reconnects forever and emits an "error" event for every failed
 * attempt. Without a listener those are unhandled events that crash the
 * process; logging every attempt would instead flood the logs.
 */
function handleRedisError(error: unknown): void {
  const now = Date.now();

  if (now - lastErrorLogAt < ERROR_LOG_INTERVAL_MS) {
    suppressedErrors += 1;
    return;
  }

  log.warn({ err: error, suppressedErrors }, "Redis client error (retrying)");
  lastErrorLogAt = now;
  suppressedErrors = 0;
}

function currentRedis(): RedisClient {
  // Lazily connect so importing modules under test never opens a real socket.
  if (!activeRedis) {
    activeRedis = new IORedis(env.REDIS_URI, { maxRetriesPerRequest: null });
    activeRedis.on("error", handleRedisError);
  }
  return activeRedis;
}

/**
 * Proxy around the active Redis client.
 *
 * Production code keeps using `redis.get(...)`, `redis.pipeline()`, etc. Tests
 * inject an in-memory replacement through `setRedis`.
 */
export const redis: RedisClient = new Proxy({} as RedisClient, {
  get(_target, property) {
    const client = currentRedis();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set(_target, property, value) {
    return Reflect.set(currentRedis(), property, value);
  },
  has(_target, property) {
    return property in currentRedis();
  },
});

export function setRedis(client: RedisClient | null): void {
  activeRedis = client;
}

/**
 * Closes the Redis connection during shutdown. Never creates a connection if
 * one was not already open.
 */
export async function closeRedis(): Promise<void> {
  const client = activeRedis;
  activeRedis = null;

  if (!client || client.status === "end") return;

  try {
    await client.quit();
  } catch {
    // `quit` waits for pending commands; if the socket is already gone, cut it.
    client.disconnect();
  }
}
