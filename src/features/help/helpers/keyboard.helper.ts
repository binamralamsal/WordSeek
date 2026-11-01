import { InlineKeyboard } from "grammy";

export type HelpSection = "howto" | "scores" | "group" | "other" | "admin";

export function getMainHelpKeyboard(
  shouldShowAdmin: boolean,
  active: HelpSection = "howto",
) {
  const keyboard = new InlineKeyboard();

  // Section shortcuts share one row; the active section uses the primary
  // button style instead of wrapping the label in « ».
  keyboard
    .text("How to Play", "help_howto")
    .style(active === "howto" ? "primary" : undefined)
    .text("Scores", "help_scores")
    .style(active === "scores" ? "primary" : undefined)
    .text("Group", "help_group")
    .style(active === "group" ? "primary" : undefined);

  keyboard
    .row()
    .text("Other", "help_other")
    .style(active === "other" ? "primary" : undefined);

  if (shouldShowAdmin) {
    keyboard
      .text("Admin", "help_admin")
      .style(active === "admin" ? "primary" : undefined);
  }

  keyboard
    .row()
    .url("GitHub Repo", "https://github.com/binamralamsal/WordSeek");

  return keyboard;
}
