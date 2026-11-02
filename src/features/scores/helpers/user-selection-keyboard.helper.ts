import { InlineKeyboard } from "grammy";

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
    keyboard.text(
      `${user.name} (ID: ${user.id})`,
      `score_select ${user.id} ${username || user.username || ""}`,
    );
    keyboard.row();
  });

  return keyboard;
}
