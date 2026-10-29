import { describe, expect, test } from "bun:test";

import {
  parseLeaderboardFilters,
  parseLeaderboardInput,
} from "#/features/scores/helpers/parse-filters.helper";

describe("parseLeaderboardInput", () => {
  test("extracts scope, period, length and target in any order", () => {
    expect(parseLeaderboardInput("global week 4 @ada")).toEqual({
      searchKey: "global",
      timeKey: "week",
      wordLength: 4,
      target: "@ada",
    });

    expect(parseLeaderboardInput("@ada 6 today group")).toEqual({
      searchKey: "group",
      timeKey: "today",
      wordLength: 6,
      target: "@ada",
    });
  });

  test("supports numeric targets", () => {
    expect(parseLeaderboardInput("12345 global").target).toBe("12345");
  });

  test("falls back to defaults", () => {
    expect(parseLeaderboardInput("", "group", "month", 5)).toEqual({
      searchKey: "group",
      timeKey: "month",
      wordLength: 5,
      target: undefined,
    });
  });

  test("treats a leading unknown word as the target", () => {
    expect(parseLeaderboardInput("ada global").target).toBe("ada");
  });

  test("accepts a null default time key as 'unset'", () => {
    expect(parseLeaderboardInput("ada", "global", null).timeKey).toBeUndefined();
  });

  test("ignores invalid word lengths", () => {
    expect(parseLeaderboardInput("global 9").wordLength).toBe(5);
  });
});

describe("parseLeaderboardFilters", () => {
  test("uses group/month/5 defaults", () => {
    expect(parseLeaderboardFilters("")).toEqual({
      searchKey: "group",
      timeKey: "month",
      wordLength: 5,
    });
  });

  test("reads all filters from the input", () => {
    expect(parseLeaderboardFilters("global all 6")).toEqual({
      searchKey: "global",
      timeKey: "all",
      wordLength: 6,
    });
  });
});
