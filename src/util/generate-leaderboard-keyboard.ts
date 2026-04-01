import { InlineKeyboard } from "grammy";

import { formatActiveButton } from "../commands/help";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import {
  AllowedWordLength,
  DISCUSSION_GROUP,
  DONATION_LINK,
  UPDATES_CHANNEL,
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "../config/constants";

const allowedWordLengths: AllowedWordLength[] = [4, 5, 6];

export function generateLeaderboardKeyboard(
  searchKey: AllowedChatSearchKey,
  timeKey: AllowedChatTimeKey,
  wordLength: AllowedWordLength = 5,
  callbackKey: "leaderboard" | `score ${string | number}` = "leaderboard",
  backButton?: { text: string; callback: string },
) {
  const keyboard = new InlineKeyboard();
  const mid = Math.floor(allowedChatSearchKeys.length / 2);

  allowedChatSearchKeys.forEach((key, index) => {
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
        `${callbackKey} ${searchKey} ${key} ${wordLength}`,
      )
      .style(timeKey === key ? "primary" : undefined);

    if ((index + 1) % 3 === 0) keyboard.row();
  });

  keyboard.row();

  allowedWordLengths.forEach((len) => {
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
