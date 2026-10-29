import { describe, expect, test } from "bun:test";

import { formatLeaderboardMessage } from "#/features/scores/helpers/format-leaderboard-message.helper";
import { formatNoScoresMessage } from "#/features/scores/helpers/format-no-scores-message.helper";
import { formatUserScoreMessage } from "#/features/scores/helpers/format-user-score-message.helper";
import { generateLeaderboardKeyboard } from "#/features/scores/helpers/leaderboard-keyboard.helper";
import { generateUserSelectionKeyboard } from "#/features/scores/helpers/user-selection-keyboard.helper";

function callbackData(button: unknown): string | undefined {
  return (button as { callback_data?: string }).callback_data;
}

const entries = [
  {
    userId: "1",
    name: "Ada",
    username: "ada",
    totalScore: 1_234,
  },
  {
    userId: "2",
    name: "Grace <Hopper>",
    username: null,
    totalScore: 42,
  },
];

describe("formatLeaderboardMessage", () => {
  test("renders entries, escapes names and links usernames", () => {
    const message = formatLeaderboardMessage(entries, "global");

    expect(message).toContain("Global");
    expect(message).toContain("Leaderboard");
    expect(message).toContain("Ada");
    expect(message).toContain('href="t.me/ada"');
    expect(message).toContain("1,234");
    expect(message).toContain("Grace &lt;Hopper&gt;");
    expect(message).toContain("42");
  });

  test("uses group wording for group leaderboards", () => {
    expect(formatLeaderboardMessage([], "group")).toContain("Group");
  });
});

describe("formatNoScoresMessage", () => {
  const base = {
    isOwnScore: true,
    searchKey: "group" as const,
    timeKey: "week" as const,
    wasTimeKeyExplicit: false,
    hasAnyScores: false,
  };

  test("suggests switching to global when no scores exist in chat", () => {
    expect(formatNoScoresMessage(base)).toContain(
      "no scores recorded in this chat",
    );
    expect(formatNoScoresMessage(base)).toContain("Global");
  });

  test("uses a generic message when the player has no scores globally", () => {
    const message = formatNoScoresMessage({ ...base, searchKey: "global" });
    expect(message).toContain("no scores recorded yet");
  });

  test("refers to another user with third-person verbs", () => {
    const message = formatNoScoresMessage({
      ...base,
      isOwnScore: false,
      userName: "Ada",
      hasAnyScores: true,
      wasTimeKeyExplicit: true,
    });

    expect(message).toContain("Ada hasn't played this week");
  });

  test("handles all-time with no scores", () => {
    expect(
      formatNoScoresMessage({
        ...base,
        timeKey: "all",
        hasAnyScores: true,
        wasTimeKeyExplicit: true,
      }),
    ).toContain("no scores recorded in this chat");
  });

  test("handles the implicit-time edge case", () => {
    expect(formatNoScoresMessage({ ...base, hasAnyScores: true })).toContain(
      "Try switching",
    );
  });
});

describe("formatUserScoreMessage", () => {
  test("includes score, rank and streak stats", () => {
    const message = formatUserScoreMessage(
      {
        totalScore: 9_876,
        rank: 12,
        name: "Ada",
        username: "ada",
        currentStreak: 4,
        highestStreak: 10,
      },
      "global",
    );

    expect(message).toContain("Ada");
    expect(message).toContain("9,876");
    expect(message).toContain("#12");
    expect(message).toContain("Current Streak:</b> 4");
    expect(message).toContain("Highest Streak:</b> 10");
    expect(message).toContain("globally");
  });

  test("defaults missing streaks to zero and supports missing username", () => {
    const message = formatUserScoreMessage(
      {
        totalScore: 1,
        rank: 1,
        name: "Grace",
        username: null,
        currentStreak: null,
        highestStreak: null,
      },
      "group",
    );

    expect(message).toContain("Current Streak:</b> 0");
    expect(message).toContain("Highest Streak:</b> 0");
    expect(message).toContain("in this chat");
    expect(message).not.toContain("https://t.me/");
  });
});

describe("keyboards", () => {
  test("leaderboard keyboard contains filters for every combination", () => {
    const keyboard = generateLeaderboardKeyboard("global", "month", 5);
    const buttons = keyboard.inline_keyboard.flat();

    // Scope buttons keep the current period.
    for (const scope of ["global", "group"]) {
      expect(
        buttons.some(
          (button) => callbackData(button) === `leaderboard ${scope} month 5`,
        ),
      ).toBe(true);
    }

    // Period buttons keep the current scope.
    for (const period of ["today", "week", "month", "year", "all"]) {
      expect(
        buttons.some(
          (button) => callbackData(button) === `leaderboard global ${period} 5`,
        ),
      ).toBe(true);
    }

    // Length buttons keep the current scope and period.
    for (const length of [4, 5, 6]) {
      expect(
        buttons.some(
          (button) =>
            callbackData(button) === `leaderboard global month ${length}`,
        ),
      ).toBe(true);
    }
  });

  test("leaderboard keyboard can be scoped to a specific user", () => {
    const keyboard = generateLeaderboardKeyboard(
      "group",
      "all",
      4,
      "score 42",
      { text: "Back", callback: "score_list ada" },
    );
    const buttons = keyboard.inline_keyboard.flat();

    expect(
      buttons.some((button) => callbackData(button) === "score 42 group all 4"),
    ).toBe(true);
    expect(
      buttons.some((button) => callbackData(button) === "score_list ada"),
    ).toBe(true);
  });

  test("user selection keyboard lists each candidate", () => {
    const keyboard = generateUserSelectionKeyboard(
      [
        { id: "1", name: "Ada", username: "ada" },
        { id: "2", name: "Grace", username: null },
      ],
      "ada",
    );

    const buttons = keyboard.inline_keyboard.flat();
    expect(buttons).toHaveLength(2);
    expect(callbackData(buttons[0]!)).toBe("score_select 1 ada");
    expect(callbackData(buttons[1]!)).toBe("score_select 2 ada");
    expect(buttons[1]!.text).toContain("Grace");
  });
});
