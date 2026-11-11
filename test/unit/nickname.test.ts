import { describe, expect, test } from "bun:test";

import {
  containsBlockedNicknameContent,
  normalizeForProfanityCheck,
  validateNickname,
} from "#/shared/nickname";

describe("nickname validation", () => {
  test("accepts normal nicknames and trims spacing", () => {
    expect(validateNickname("Ada Lovelace")).toEqual({
      ok: true,
      value: "Ada Lovelace",
    });
    expect(validateNickname("  grace_hopper5  ")).toEqual({
      ok: true,
      value: "grace_hopper5",
    });
    expect(validateNickname("word-seeker.42")).toEqual({
      ok: true,
      value: "word-seeker.42",
    });
  });

  test("rejects wrong lengths and empty values", () => {
    expect(validateNickname("")).toMatchObject({ ok: false });
    expect(validateNickname("ab")).toMatchObject({ ok: false });
    expect(validateNickname("a".repeat(21))).toMatchObject({ ok: false });
    expect(validateNickname(42)).toMatchObject({ ok: false });
  });

  test("rejects unsupported characters and separator runs", () => {
    expect(validateNickname("hello!")).toMatchObject({ ok: false });
    expect(validateNickname("-hello")).toMatchObject({ ok: false });
    expect(validateNickname("hello__there")).toMatchObject({ ok: false });
    expect(validateNickname("12345")).toMatchObject({ ok: false });
  });

  test("rejects profanity without blocking ordinary words", () => {
    expect(validateNickname("assassin")).toMatchObject({ ok: true });
    expect(validateNickname("class act")).toMatchObject({ ok: true });
    expect(validateNickname("f.u.c.k")).toMatchObject({ ok: false });
    expect(validateNickname("sh1thead")).toMatchObject({ ok: false });
    expect(containsBlockedNicknameContent("f.u.c.k")).toBe(true);
  });

  test("normalizes leetspeak for blocklist matching", () => {
    expect(normalizeForProfanityCheck("Sh1t")).toBe("shit");
    expect(normalizeForProfanityCheck("F.U.C.K")).toBe("f u c k");
  });

  test("rejects reserved names even with separators", () => {
    expect(validateNickname("WordSeek")).toMatchObject({ ok: false });
    expect(validateNickname("word_seek")).toMatchObject({ ok: false });
    expect(validateNickname("Telegram")).toMatchObject({ ok: false });
  });
});
