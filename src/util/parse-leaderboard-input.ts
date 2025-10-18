import {
  allowedChatSearchKeys,
  allowedChatTimeKeys,
} from "../config/constants";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

type ParseResult = {
  searchKey: AllowedChatSearchKey | undefined;
  timeKey: AllowedChatTimeKey | undefined;
  target: string | undefined;
};

export function parseLeaderboardInput(
  input: string,
  defaultSearchKey?: AllowedChatSearchKey,
  defaultTimeKey?: AllowedChatTimeKey | null,
): ParseResult {
  const parts = input.toLowerCase().trim().split(/\s+/).filter(Boolean);

  let target: string | undefined;
  let foundSearchKey: AllowedChatSearchKey | undefined;
  let foundTimeKey: AllowedChatTimeKey | undefined;

  for (const part of parts) {
    if (allowedChatSearchKeys.includes(part as AllowedChatSearchKey)) {
      foundSearchKey = part as AllowedChatSearchKey;
      continue;
    }

    if (allowedChatTimeKeys.includes(part as AllowedChatTimeKey)) {
      foundTimeKey = part as AllowedChatTimeKey;
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

  return { searchKey, timeKey, target };
}

// Simplified version for commands that don't need target parsing
export function parseLeaderboardFilters(
  input: string,
  defaultSearchKey?: AllowedChatSearchKey,
  defaultTimeKey?: AllowedChatTimeKey | null,
) {
  const parts = input.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const foundSearchKey = parts.find((part) =>
    allowedChatSearchKeys.includes(part as AllowedChatSearchKey),
  ) as AllowedChatSearchKey | undefined;

  const foundTimeKey = parts.find((part) =>
    allowedChatTimeKeys.includes(part as AllowedChatTimeKey),
  ) as AllowedChatTimeKey | undefined;

  const searchKey = foundSearchKey || defaultSearchKey;
  const timeKey =
    foundTimeKey || (defaultTimeKey === null ? undefined : defaultTimeKey);

  return { searchKey, timeKey };
}
