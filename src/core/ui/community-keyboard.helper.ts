import { InlineKeyboard } from "grammy";

import { DISCUSSION_GROUP, UPDATES_CHANNEL } from "#/config/constants";

export function getCommunityKeyboard() {
  return new InlineKeyboard()
    .url("Updates", UPDATES_CHANNEL)
    .url("Discussion", DISCUSSION_GROUP);
}
