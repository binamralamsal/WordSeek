import { randomUUID } from "node:crypto";

import { redis } from "#/config/redis";
import { createLogger } from "#/core/logging/logger.service";
import { redisKeys } from "#/core/redis-keys.constants";

const log = createLogger("core.services.instance-lock.service");

const LOCK_TTL_MS = 30_000;
const HEARTBEAT_MS = 10_000;
const ACQUIRE_TIMEOUT_MS = 10_000;

/**
 * Both scripts compare the stored token before touching the key, so a process
 * that lost the lock can never delete or extend a lock owned by someone else.
 */
const RENEW_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
  end
  return 0
`;

const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

let token: string | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

export interface InstanceLockOptions {
  /** Called when the lock is lost after startup, so the caller can shut down. */
  onLost?: () => void;
}

/**
 * Claim a Redis-backed single-instance lock.
 *
 * Telegram allows only one long-polling consumer per bot token, so a second
 * replica would fail with `409 Conflict` and process updates twice. Returning
 * `false` lets startup fail with a clear error instead of a retry storm.
 */
export async function acquireInstanceLock(
  options: InstanceLockOptions = {},
): Promise<boolean> {
  const candidate = randomUUID();

  const result = await withTimeout(
    redis.set(redisKeys.instanceLock, candidate, "PX", LOCK_TTL_MS, "NX"),
    ACQUIRE_TIMEOUT_MS,
    "Timed out acquiring the instance lock",
  );

  if (result !== "OK") return false;

  token = candidate;
  heartbeat = setInterval(() => void renew(options), HEARTBEAT_MS);
  heartbeat.unref?.();

  log.info("Instance lock acquired");
  return true;
}

export async function releaseInstanceLock(): Promise<void> {
  stopHeartbeat();

  const owned = token;
  token = null;

  if (!owned) return;

  try {
    await redis.eval(RELEASE_SCRIPT, 1, redisKeys.instanceLock, owned);
  } catch (error) {
    log.warn({ err: error }, "Failed to release the instance lock");
  }
}

async function renew({ onLost }: InstanceLockOptions): Promise<void> {
  const owned = token;
  if (!owned) return;

  try {
    const renewed = await redis.eval(
      RENEW_SCRIPT,
      1,
      redisKeys.instanceLock,
      owned,
      LOCK_TTL_MS,
    );

    if (Number(renewed) === 1) return;

    log.error("Instance lock is no longer owned");
  } catch (error) {
    log.error({ err: error }, "Failed to renew the instance lock");
  }

  stopHeartbeat();
  onLost?.();
}

function stopHeartbeat(): void {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    timer.unref?.();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
