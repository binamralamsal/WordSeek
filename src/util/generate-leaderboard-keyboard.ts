import { InlineKeyboard } from "grammy";

import {
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
    keyboard.text(
      generateButtonText(
        searchKey,
        key,
        key === "group" ? "This chat" : "Global",
      ),
      `${callbackKey} ${key} ${timeKey}`,
    );
  });

  keyboard.row();

  allowedChatTimeKeys.forEach((key, index) => {
    keyboard.text(
      generateButtonText(
        timeKey,
        key,
        key === "all" ? "All time" : key === "today" ? "Today" : `This ${key}`,
      ),
      `${callbackKey} ${searchKey} ${key}`,
    );
    if ((index + 1) % 3 === 0) {
      keyboard.row();
    }
  });

  keyboard.row();
  keyboard.text("🔄 Refresh", `${callbackKey} ${searchKey} ${timeKey}`);

  if (backButton) {
    keyboard.text(backButton.text, backButton.callback);
  }

  return keyboard;
}

function generateButtonText<T>(key: T, currentKey: T, label: string) {
  return `${key === currentKey ? "✅ " : ""}${label}`;
}
