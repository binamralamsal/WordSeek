import { InlineKeyboard } from "grammy";

import { formatActiveButton } from "../commands/help";
import {
  DISCUSSION_GROUP,
  UPDATES_CHANNEL,
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "../config/constants";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

export function generateLeaderboardKeyboard(
  searchKey: AllowedChatSearchKey,
  timeKey: AllowedChatTimeKey,
  callbackKey: "leaderboard" | `score ${string | number}` = "leaderboard",
  backButton?: { text: string; callback: string },
) {
  const keyboard = new InlineKeyboard();

  allowedChatSearchKeys.forEach((key) => {
    keyboard
      .text(
        generateButtonText(
          searchKey,
          key,
          key === "group" ? "This chat" : "Global",
        ),
        `${callbackKey} ${key} ${timeKey}`,
      )
      .style(searchKey === key ? "primary" : undefined);
  });

  keyboard.row();

  allowedChatTimeKeys.forEach((key, index) => {
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
        `${callbackKey} ${searchKey} ${key}`,
      )
      .style(timeKey === key ? "primary" : undefined);

    if ((index + 1) % 3 === 0) {
      keyboard.row();
    }
  });

  keyboard.row();
  keyboard.url("📢 Updates", UPDATES_CHANNEL);
  keyboard
    .text("🔄", `${callbackKey} ${searchKey} ${timeKey}`);
  keyboard.url("💬 Discussion", DISCUSSION_GROUP);

  if (backButton) {
    keyboard.text(backButton.text, backButton.callback);
  }

  return keyboard;
}

function generateButtonText<T>(key: T, currentKey: T, label: string) {
  return formatActiveButton(label, key === currentKey);
}
