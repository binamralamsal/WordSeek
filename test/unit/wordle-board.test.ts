import { describe, expect, test } from "bun:test";

import {
  ALL_WORDS,
  MODE_LABEL,
} from "#/features/wordle/shared/helpers/words.helper";
import {
  buildRichFeedback,
  evaluateGuess,
  getHint,
  renderGuessRow,
} from "#/features/wordle/shared/helpers/board.helper";

describe("evaluateGuess", () => {
  test("marks exact matches as correct", () => {
    expect(evaluateGuess("crane", "crane")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  test("marks present letters and absent letters", () => {
    expect(evaluateGuess("salet", "stale")).toEqual([
      "correct",
      "present",
      "present",
      "present",
      "present",
    ]);
  });

  test("does not reuse a letter more times than it appears", () => {
    expect(evaluateGuess("allee", "apple")).toEqual([
      "correct",
      "present",
      "absent",
      "absent",
      "correct",
    ]);
  });

  test("is case insensitive", () => {
    expect(evaluateGuess("CrAnE", "crane")).toEqual(
      evaluateGuess("crane", "crane"),
    );
  });

  test("supports variable word lengths", () => {
    expect(evaluateGuess("abcd", "abdc")).toEqual([
      "correct",
      "correct",
      "present",
      "present",
    ]);
  });
});

describe("getHint", () => {
  test("explains each state", () => {
    expect(getHint("correct", "a")).toContain('"a"');
    expect(getHint("correct", "a").toLowerCase()).toContain("right spot");
    expect(getHint("present", "b").toLowerCase()).toContain("different spot");
    expect(getHint("absent", "c").toLowerCase()).toContain("isn't in the word");
  });

  test("returns a fallback for unknown states", () => {
    expect(getHint("nope", "z")).toBe("Unknown hint.");
  });
});

describe("renderGuessRow", () => {
  test("renders one rich-text button per letter", () => {
    const row = renderGuessRow("crane", "crane");

    expect(row.startsWith("<p>")).toBe(true);
    expect(row.endsWith("</p>")).toBe(true);
    expect(row.match(/<tg-button/g)).toHaveLength(5);
    expect(row).toContain('data="wh:correct:C"');
  });

  test("uses danger styling for absent letters", () => {
    expect(renderGuessRow("zzzzz", "crane")).toContain('style="danger"');
  });
});

describe("buildRichFeedback", () => {
  test("includes the mode label and guess count", () => {
    const feedback = buildRichFeedback(
      [
        { id: 1, guess: "crane", createdAt: new Date(), updatedAt: new Date() },
        { id: 2, guess: "salet", createdAt: new Date(), updatedAt: new Date() },
      ],
      "crane",
      "5-letter mode",
    );

    expect(feedback).toContain("5-letter mode");
    expect(feedback).toContain("2/30 guesses");
    expect(feedback.match(/<tg-button/g)).toHaveLength(10);
  });
});

describe("word lists", () => {
  test("exposes words and labels for every supported length", () => {
    for (const length of [4, 5, 6] as const) {
      expect(ALL_WORDS[length].length).toBeGreaterThan(100);
      expect(ALL_WORDS[length].every((word) => word.length === length)).toBe(
        true,
      );
      expect(MODE_LABEL[length]).toBe(`${length}-letter mode`);
    }
  });
});
