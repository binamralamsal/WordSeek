import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { setRedis } from "#/config/redis";
import { redisKeys } from "#/core/redis-keys.constants";
import {
  acquireInstanceLock,
  releaseInstanceLock,
} from "#/core/services/instance-lock.service";

import { createRedisMock, RedisMock } from "../helpers/redis-mock";

describe("instance lock", () => {
  let redisMock: RedisMock;

  beforeEach(() => {
    redisMock = new RedisMock();
    setRedis(createRedisMock(redisMock));
  });

  afterEach(async () => {
    await releaseInstanceLock();
    setRedis(null);
  });

  test("allows only one owner at a time", async () => {
    expect(await acquireInstanceLock()).toBe(true);
    expect(await acquireInstanceLock()).toBe(false);
  });

  test("releases the lock so a restarted process can start", async () => {
    await acquireInstanceLock();

    await releaseInstanceLock();

    expect(redisMock.strings.has(redisKeys.instanceLock)).toBe(false);
    expect(await acquireInstanceLock()).toBe(true);
  });

  test("does not delete a lock owned by another instance", async () => {
    await acquireInstanceLock();
    redisMock.strings.set(redisKeys.instanceLock, "another-instance");

    await releaseInstanceLock();

    expect(redisMock.strings.get(redisKeys.instanceLock)).toBe(
      "another-instance",
    );
  });
});
