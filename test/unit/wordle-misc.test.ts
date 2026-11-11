import { describe, expect, test } from "bun:test";

import { redisKeys } from "#/core/redis-keys.constants";
import {
  getCurrentGameDateString,
  getDateStringFromDate,
} from "#/features/wordle/daily/helpers/date.helper";
import { dailyWordleSchema } from "#/features/wordle/shared/helpers/daily-session.helper";

describe("date helpers", () => {
  test("formats dates as YYYY-MM-DD", () => {
    expect(getDateStringFromDate(new Date("2025-03-09T12:00:00Z"))).toBe(
      "2025-03-09",
    );
  });

  test("current game date is a valid date string", () => {
    const value = getCurrentGameDateString();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const today = getDateStringFromDate(new Date());
    const yesterday = getDateStringFromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    expect([today, yesterday]).toContain(value);
  });
});

describe("dailyWordleSchema", () => {
  test("accepts a valid session", () => {
    expect(
      dailyWordleSchema.parse({ dailyWordId: 3, date: "2025-01-02" }),
    ).toEqual({ dailyWordId: 3, date: "2025-01-02" });
  });

  test("rejects invalid sessions", () => {
    expect(dailyWordleSchema.safeParse({}).success).toBe(false);
    expect(
      dailyWordleSchema.safeParse({ dailyWordId: "3", date: "x" }).success,
    ).toBe(false);
  });
});

describe("redisKeys", () => {
  test("builds namespaced keys", () => {
    expect(redisKeys.vote(-1001)).toBe("vote:-1001");
    expect(redisKeys.dailySession(42)).toBe("daily_wordle:42");
    expect(redisKeys.captcha(-1001, 42)).toBe("captcha:-1001:42");
    expect(redisKeys.wordHistory(-1001, 5)).toBe("h:-1001:5");
    expect(redisKeys.tracking(-1001)).toBe("tracking:-1001");
    expect(redisKeys.trackingPattern).toBe("tracking:*");
    expect(redisKeys.greetingTrack(42, "byee", "2025-01-01")).toBe(
      "greetingTrack:42:byee:2025-01-01",
    );
    expect(redisKeys.geminiFailedKeys).toBe("seek-gemini:failed_keys");
    expect(redisKeys.broadcastState).toBe("broadcast:state");
    expect(redisKeys.broadcastLock).toBe("broadcast:lock");
  });
});
