import { describe, expect, test } from "bun:test";

import {
  parseLeaderboardCallback,
  parseScoreCallback,
  parseScoreListCallback,
  parseScoreSelectCallback,
} from "#/features/scores/helpers/callback-data.helper";

describe("parseLeaderboardCallback", () => {
  test("parses a complete filter payload", () => {
    expect(parseLeaderboardCallback("leaderboard global month 5")).toEqual({
      searchKey: "global",
      timeKey: "month",
      wordLength: 5,
    });
  });

  test.each([
    ["leaderboard global month"],
    ["leaderboard global month 5 extra"],
    ["leaderboard everyone month 5"],
    ["leaderboard global decade 5"],
    ["leaderboard global month 7"],
    ["leaderboard global month abc"],
    [""],
  ])("rejects invalid payload %p", (payload) => {
    expect(parseLeaderboardCallback(payload)).toBeNull();
  });
});

describe("parseScoreCallback", () => {
  test("parses a score callback", () => {
    expect(parseScoreCallback("score 123 group week 4")).toEqual({
      userId: "123",
      searchKey: "group",
      timeKey: "week",
      wordLength: 4,
    });
  });

  test("rejects payloads with an invalid user or filter", () => {
    expect(parseScoreCallback("score")).toBeNull();
    expect(parseScoreCallback("score 123 group week")).toBeNull();
    expect(parseScoreCallback("score 123 nope week 5")).toBeNull();
    expect(parseScoreCallback("score 123 group nope 5")).toBeNull();
    expect(parseScoreCallback("score 123 group week 9")).toBeNull();
  });
});

describe("parseScoreListCallback", () => {
  test("extracts the username", () => {
    expect(parseScoreListCallback("score_list ada")).toBe("ada");
  });

  test("returns null without a username", () => {
    expect(parseScoreListCallback("score_list")).toBeNull();
  });
});

describe("parseScoreSelectCallback", () => {
  test("extracts user id and username", () => {
    expect(parseScoreSelectCallback("score_select 42 ada")).toEqual({
      userId: "42",
      username: "ada",
    });
  });

  test("supports a missing username", () => {
    expect(parseScoreSelectCallback("score_select 42")).toEqual({
      userId: "42",
      username: undefined,
    });
  });

  test("returns null without a user id", () => {
    expect(parseScoreSelectCallback("score_select")).toBeNull();
  });
});
