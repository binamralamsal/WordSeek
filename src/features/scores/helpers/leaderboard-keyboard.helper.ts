import { InlineKeyboard } from "grammy";

import { formatActiveButton } from "#/core/ui/format-active-button.helper";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";
import { LEADERBOARD_PERIODS, LEADERBOARD_SCOPES, WORD_LENGTHS } from "#/types";
import {
  DISCUSSION_GROUP,
  DONATION_LINK,
  UPDATES_CHANNEL,
} from "#/config/constants";

export type LeaderboardCallbackKey = "leaderboard" | `score ${string}`;

export function generateLeaderboardKeyboard(
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength = 5,
  callbackKey: LeaderboardCallbackKey = "leaderboard",
  backButton?: { text: string; callback: string },
) {
  const keyboard = new InlineKeyboard();
  const mid = Math.floor(LEADERBOARD_SCOPES.length / 2);

  LEADERBOARD_SCOPES.forEach((key, index) => {
    if (index === mid) {
      keyboard.text(
        "🔄",
        `${callbackKey} ${searchKey} ${timeKey} ${wordLength}`,
      );
    }

    keyboard
      .text(
        generateButtonText(
          searchKey,
          key,
          key === "group" ? "This chat" : "Global",
        ),
        `${callbackKey} ${key} ${timeKey} ${wordLength}`,
      )
      .style(searchKey === key ? "primary" : undefined);
  });

  keyboard.row();

  LEADERBOARD_PERIODS.forEach((key, index) => {
    keyboard
      .text(
        generateButtonText(
          timeKey,
          key,
          key === "all"
            ? "All time"
            : key === "today"
              ? "Today"
              : `This ${key}`,
        ),
        `${callbackKey} ${searchKey} ${key} ${wordLength}`,
      )
      .style(timeKey === key ? "primary" : undefined);

    if ((index + 1) % 3 === 0) keyboard.row();
  });

  keyboard.row();

  WORD_LENGTHS.forEach((len) => {
    keyboard
      .text(
        generateButtonText(wordLength, len, `${len} letters`),
        `${callbackKey} ${searchKey} ${timeKey} ${len}`,
      )
      .style(wordLength === len ? "primary" : undefined);
  });

  keyboard.row();
  keyboard.url("📢 Updates", UPDATES_CHANNEL);
  keyboard.url("💓 Donate", DONATION_LINK).success();
  keyboard.url("💬 Discussion", DISCUSSION_GROUP);

  if (backButton) {
    keyboard.row();
    keyboard.text(backButton.text, backButton.callback);
  }

  return keyboard;
}

function generateButtonText<T>(key: T, currentKey: T, label: string) {
  return formatActiveButton(label, key === currentKey);
}
