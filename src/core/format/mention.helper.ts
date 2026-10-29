type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
};

export function formatDisplayName(user: {
  first_name: string;
  last_name?: string;
}) {
  return user.first_name + (user.last_name ? ` ${user.last_name}` : "");
}

export function formatUserLink(user: TelegramUser) {
  return `<a href="tg://user?id=${user.id}">${formatDisplayName(user)}</a>`;
}

export function formatUserMention({
  id,
  name,
  username,
}: {
  id: string;
  name?: string | null;
  username?: string | null;
}) {
  if (username) return `@${username}`;
  return `<a href="tg://user?id=${id}">${name || "User"}</a>`;
}
