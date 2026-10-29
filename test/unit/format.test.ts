import { describe, expect, test } from "bun:test";

import { escapeHtml } from "#/core/format/escape-html.helper";
import { formatDuration } from "#/core/format/duration.helper";
import {
  formatDisplayName,
  formatUserLink,
  formatUserMention,
} from "#/core/format/mention.helper";
import { formatActiveButton } from "#/core/ui/format-active-button.helper";

describe("escapeHtml", () => {
  test("escapes every HTML-sensitive character", () => {
    expect(escapeHtml(`<a href="x">&'y'/</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;y&#39;&#x2F;&lt;&#x2F;a&gt;",
    );
  });

  test("leaves plain text untouched", () => {
    expect(escapeHtml("plain text 123")).toBe("plain text 123");
  });
});

describe("mention helpers", () => {
  test("formatDisplayName includes the last name when present", () => {
    expect(formatDisplayName({ first_name: "Ada" })).toBe("Ada");
    expect(formatDisplayName({ first_name: "Ada", last_name: "Lovelace" })).toBe(
      "Ada Lovelace",
    );
  });

  test("formatUserLink creates a tg link", () => {
    expect(formatUserLink({ id: 42, first_name: "Ada" })).toBe(
      `<a href="tg://user?id=42">Ada</a>`,
    );
  });

  test("formatUserMention prefers a username over a link", () => {
    expect(formatUserMention({ id: "42", name: "Ada", username: "ada" })).toBe(
      "@ada",
    );
    expect(formatUserMention({ id: "42", name: "Ada", username: null })).toBe(
      `<a href="tg://user?id=42">Ada</a>`,
    );
    expect(formatUserMention({ id: "42" })).toBe(
      `<a href="tg://user?id=42">User</a>`,
    );
  });
});

describe("formatActiveButton", () => {
  test("decorates active buttons and leaves inactive ones as-is", () => {
    const active = formatActiveButton("Today", true);
    const inactive = formatActiveButton("Today", false);

    expect(active).toContain("Today");
    expect(active).not.toBe(inactive);
    expect(inactive).toBe("Today");
  });
});

describe("formatDuration", () => {
  test.each([
    [1_000, "1 second"],
    [2_000, "2 seconds"],
    [60_000, "1 minute"],
    [120_000, "2 minutes"],
    [3_600_000, "1 hour"],
    [7_200_000, "2 hours"],
    [86_400_000, "1 day"],
    [172_800_000, "2 days"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  test("only reports the largest unit", () => {
    expect(formatDuration(90_000)).toBe("1 minute");
    expect(formatDuration(90_061_000)).toBe("1 day");
  });
});
