import { InlineKeyboard } from "grammy";

import { formatActiveButton } from "#/core/ui/format-active-button.helper";
import {
  DISCUSSION_GROUP,
  DONATION_LINK,
  UPDATES_CHANNEL,
} from "#/config/constants";

export type HelpSection = "howto" | "scores" | "group" | "other" | "admin";

export function getMainHelpKeyboard(
  shouldShowAdmin: boolean,
  active: HelpSection = "howto",
) {
  const keyboard = new InlineKeyboard()
    .text(formatActiveButton("How to Play", active === "howto"), "help_howto")
    .style(active === "howto" ? "primary" : undefined)
    .text(
      formatActiveButton("Leaderboard & Scores", active === "scores"),
      "help_scores",
    )
    .style(active === "scores" ? "primary" : undefined)
    .row()
    .text(
      formatActiveButton("Group Settings", active === "group"),
      "help_group",
    )
    .style(active === "group" ? "primary" : undefined)
    .text(
      formatActiveButton("Other Commands", active === "other"),
      "help_other",
    )
    .style(active === "other" ? "primary" : undefined);

  if (shouldShowAdmin) {
    keyboard
      .row()
      .text(
        formatActiveButton("👑 Admin Commands", active === "admin"),
        "help_admin",
      )
      .style(active === "admin" ? "primary" : undefined);
  }
  keyboard.url("GitHub Repo", "https://github.com/binamralamsal/WordSeek");
  keyboard.row().url("📢 Updates", UPDATES_CHANNEL);
  keyboard.url("💓 Donate", DONATION_LINK).success();
  keyboard.url("💬 Discussion", DISCUSSION_GROUP);

  return keyboard;
}
