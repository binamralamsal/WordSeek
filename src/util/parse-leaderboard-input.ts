import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import {
  AllowedWordLength,
  allowedChatSearchKeys,
  allowedChatTimeKeys,
  allowedWordLengths,
} from "../config/constants";

type ParseResult = {
  searchKey: AllowedChatSearchKey | undefined;
  timeKey: AllowedChatTimeKey | undefined;
  wordLength: AllowedWordLength;
  target: string | undefined;
};

export function parseLeaderboardInput(
  input: string,
  defaultSearchKey?: AllowedChatSearchKey,
  defaultTimeKey?: AllowedChatTimeKey | null,
  defaultWordLength: AllowedWordLength = 5,
): ParseResult {
  const parts = input.toLowerCase().trim().split(/\s+/).filter(Boolean);

  let target: string | undefined;
  let foundSearchKey: AllowedChatSearchKey | undefined;
  let foundTimeKey: AllowedChatTimeKey | undefined;
  let foundWordLength: AllowedWordLength | undefined;

  for (const part of parts) {
    if (allowedChatSearchKeys.includes(part as AllowedChatSearchKey)) {
      foundSearchKey = part as AllowedChatSearchKey;
      continue;
    }

    if (allowedChatTimeKeys.includes(part as AllowedChatTimeKey)) {
      foundTimeKey = part as AllowedChatTimeKey;
      continue;
    }

    if (allowedWordLengths.includes(Number(part) as AllowedWordLength)) {
      foundWordLength = Number(part) as AllowedWordLength;
      continue;
    }

    if (part.startsWith("@") || /^\d+$/.test(part)) {
      target = part;
      continue;
    }

    if (!target && parts.indexOf(part) === 0) {
      target = part;
    }
  }

  const searchKey = foundSearchKey || defaultSearchKey;
  const timeKey =
    foundTimeKey || (defaultTimeKey === null ? undefined : defaultTimeKey);
  const wordLength = foundWordLength ?? defaultWordLength;

  return { searchKey, timeKey, wordLength, target };
}

export function parseLeaderboardFilters(
  input: string,
  defaultSearchKey: AllowedChatSearchKey = "group",
  defaultTimeKey: AllowedChatTimeKey = "month",
) {
  const parts = input.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const searchKey = (parts.find((part) =>
    allowedChatSearchKeys.includes(part as AllowedChatSearchKey),
  ) || defaultSearchKey) as AllowedChatSearchKey;

  const timeKey = (parts.find((part) =>
    allowedChatTimeKeys.includes(part as AllowedChatTimeKey),
  ) || defaultTimeKey) as AllowedChatTimeKey;

  const wordLengthPart = parts.find((part) =>
    allowedWordLengths.includes(Number(part) as AllowedWordLength),
  );
  const wordLength: AllowedWordLength = wordLengthPart
    ? (Number(wordLengthPart) as AllowedWordLength)
    : 5;

  return { searchKey, timeKey, wordLength };
}
