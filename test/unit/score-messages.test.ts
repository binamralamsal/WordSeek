import { describe, expect, test } from "bun:test";

import { renderInlineKeyboard } from "#/core/telegram/rich-keyboard.helper";
import { formatLeaderboardMessage } from "#/features/scores/helpers/format-leaderboard-message.helper";
import { formatNoScoresMessage } from "#/features/scores/helpers/format-no-scores-message.helper";
import { formatUserScoreMessage } from "#/features/scores/helpers/format-user-score-message.helper";
import { generateLeaderboardKeyboard } from "#/features/scores/helpers/leaderboard-keyboard.helper";
import { generateUserSelectionKeyboard } from "#/features/scores/helpers/user-selection-keyboard.helper";

import { parseRichButtons } from "../helpers/rich-message";

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
    const message = formatLeaderboardMessage(entries, "global", "week", 5);

    expect(message).toContain("Global");
    expect(message).toContain("Leaderboard");
    expect(message).toContain("Ada");
    expect(message).toContain('href="https://t.me/ada"');
    expect(message).toContain("1,234");
    expect(message).toContain("Grace &lt;Hopper&gt;");
    expect(message).toContain("42");
    expect(message).toContain("This week");
    expect(message).toContain("5 letters");
    expect(message).toContain("<h4>");
    expect(message).toContain("<blockquote>");
  });

  test("groups the podium and ten players per blockquote", () => {
    const manyEntries = Array.from({ length: 14 }, (_, index) => ({
      userId: String(index + 1),
      name: `Player ${index + 1}`,
      username: null,
      totalScore: 100 - index,
    }));

    const message = formatLeaderboardMessage(manyEntries, "global", "all", 5);

    expect(message.match(/<blockquote>/g)).toHaveLength(3);
    expect(message).toContain("🥇");
    expect(message).toContain("🥉");
    expect(message).toContain("🔅");
    expect(message).not.toContain("<b>#4</b>");
    expect(message).not.toContain("<table");
  });

  test("reveals selected user ids next to their names in private chats", () => {
    const message = formatLeaderboardMessage(entries, "global", "week", 5, {
      revealIds: new Set(["1"]),
    });

    expect(message).toContain("Ada</a> <code>1</code>");
    expect(message).not.toContain("<code>2</code>");
  });

  test("uses chat wording for group-scoped leaderboards in DMs and groups", () => {
    expect(formatLeaderboardMessage([], "group", "today", 4)).toContain(
      "This chat",
    );
  });

  test("shows a friendly empty state instead of an empty table", () => {
    const message = formatLeaderboardMessage([], "global", "all", 6);

    expect(message).toContain("No scores for this filter yet");
    expect(message).not.toContain("<table");
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
      "week",
      5,
    );

    expect(message).toContain("Ada");
    expect(message).toContain("<h4>📊 Score Report · Ada</h4>");
    expect(message).toContain("9,876");
    expect(message).toContain("#12");
    expect(message).toContain("Current streak");
    expect(message).toContain("4 days");
    expect(message).toContain("Best streak");
    expect(message).toContain("10 days");
    expect(message).toContain("globally");
    expect(message).toContain("This week");
    expect(message).toContain("<blockquote>");
    expect(message).not.toContain("@ada");
    expect(message).not.toContain("Daily WordSeek streaks");
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
      "today",
      4,
    );

    expect(message).toContain("0 days");
    expect(message).toContain("in this chat");
    expect(message).toContain("Today");
    expect(message).not.toContain('href="https://t.me/grace"');
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

  test("renders keyboard buttons into rich message rows", () => {
    const keyboard = generateLeaderboardKeyboard("global", "month", 5);
    const html = renderInlineKeyboard(keyboard);

    expect(html).toContain("<tg-button-row");
    expect(html).not.toContain('align="center"');
    expect(html).not.toContain("reply_markup");

    const buttons = parseRichButtons(html);
    expect(
      buttons.some((button) => button.data === "leaderboard group month 5"),
    ).toBe(true);
    expect(
      buttons.some((button) => button.data === "leaderboard global month 6"),
    ).toBe(true);
  });

  test("keeps the leaderboard keyboard to three compact rows", () => {
    const keyboard = generateLeaderboardKeyboard("global", "month", 5);

    expect(keyboard.inline_keyboard).toHaveLength(3);
    expect(keyboard.inline_keyboard[0]).toHaveLength(3);
    expect(keyboard.inline_keyboard[1]).toHaveLength(5);
    expect(keyboard.inline_keyboard[2]).toHaveLength(3);

    // Refresh sits between the two scope buttons.
    expect(keyboard.inline_keyboard[0]!.map((button) => button.text)).toEqual([
      "🌍 Global",
      "🔄",
      "💬 This chat",
    ]);
  });
});
