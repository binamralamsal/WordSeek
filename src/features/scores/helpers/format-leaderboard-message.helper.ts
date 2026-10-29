import { escapeHtml } from "#/core/format/escape-html.helper";
import type { LeaderboardEntry, LeaderboardScope } from "#/types";

export function formatLeaderboardMessage(
  data: LeaderboardEntry[],
  searchKey: LeaderboardScope,
) {
  const blocks = data.reduce((acc, entry, index) => {
    const rank = index < 3 ? ["🥇", "🥈", "🥉"][index] : "🔅";

    let usernameLink = escapeHtml(entry.name);
    if (entry.username) {
      usernameLink = `<a href="t.me/${entry.username}">${escapeHtml(
        entry.name,
      )}</a>`;
    }

    const line = `${rank}${usernameLink} - ${entry.totalScore.toLocaleString()} pts`;

    if (index === 0 || index === 3 || (index > 3 && (index - 3) % 10 === 0)) {
      acc.push([]);
    }
    acc[acc.length - 1]!.push(line);

    return acc;
  }, [] as string[][]);

  const formattedEntries = blocks
    .map((block) => `<blockquote>${block.join("\n")}</blockquote>`)
    .join("\n");

  return `<blockquote>🏆 ${
    searchKey === "global" ? "Global" : "Group"
  } Leaderboard 🏆</blockquote>\n\n${formattedEntries}`;
}
