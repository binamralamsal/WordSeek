import { describe, expect, test } from "bun:test";

import { isUniqueViolation } from "#/core/database/errors.helper";

describe("isUniqueViolation", () => {
  test("detects Postgres unique violations by error code", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  test("detects them by message when the code is unavailable", () => {
    expect(
      isUniqueViolation({
        message:
          'duplicate key value violates unique constraint "games_active_chat_unique"',
      }),
    ).toBe(true);
  });

  test("ignores unrelated errors and empty values", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
