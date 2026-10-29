import { InlineKeyboard } from "grammy";

import { escapeHtml } from "#/core/format/escape-html";

type User = {
  id: string;
  name: string;
  username: string | null;
};

export function generateUserSelectionKeyboard(
  users: User[],
  username?: string,
) {
  const keyboard = new InlineKeyboard();

  users.forEach((user) => {
    const escapedName = escapeHtml(user.name);
    const buttonText = `${escapedName} (ID: ${user.id})`;
    keyboard.text(
      buttonText,
      `score_select ${user.id} ${username || user.username || ""}`,
    );
    keyboard.row();
  });

  return keyboard;
}
