import { InlineKeyboard } from "grammy";

import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";
import { WORD_LENGTHS } from "#/types";

export type LeaderboardCallbackKey = "leaderboard" | `score ${string}`;

const PERIOD_BUTTONS: [LeaderboardPeriod, string][] = [
  ["today", "Today"],
  ["week", "Week"],
  ["month", "Month"],
  ["year", "Year"],
  ["all", "All"],
];

export function generateLeaderboardKeyboard(
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength = 5,
  callbackKey: LeaderboardCallbackKey = "leaderboard",
  backButton?: { text: string; callback: string },
) {
  const keyboard = new InlineKeyboard();

  // Scope and refresh share one row to keep the keyboard compact.
  keyboard
    .text("🌍 Global", `${callbackKey} global ${timeKey} ${wordLength}`)
    .style(searchKey === "global" ? "primary" : undefined)
    .text("💬 This chat", `${callbackKey} group ${timeKey} ${wordLength}`)
    .style(searchKey === "group" ? "primary" : undefined)
    .text("🔄", `${callbackKey} ${searchKey} ${timeKey} ${wordLength}`);

  keyboard.row();

  // Five short labels fit on one line, which removes two rows from the old
  // layout. The active filter is highlighted with the primary style.
  for (const [period, label] of PERIOD_BUTTONS) {
    keyboard
      .text(label, `${callbackKey} ${searchKey} ${period} ${wordLength}`)
      .style(timeKey === period ? "primary" : undefined);
  }

  keyboard.row();

  for (const length of WORD_LENGTHS) {
    keyboard
      .text(
        `${length} letters`,
        `${callbackKey} ${searchKey} ${timeKey} ${length}`,
      )
      .style(wordLength === length ? "primary" : undefined);
  }

  if (backButton) {
    keyboard.row();
    keyboard.text(backButton.text, backButton.callback);
  }

  return keyboard;
}
