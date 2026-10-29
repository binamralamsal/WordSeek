import IORedis from "ioredis";

import { env } from "./env";

type RedisClient = IORedis;

let activeRedis: RedisClient | null = null;

function currentRedis(): RedisClient {
  // Lazily connect so importing modules under test never opens a real socket.
  activeRedis ??= new IORedis(env.REDIS_URI, { maxRetriesPerRequest: null });
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
