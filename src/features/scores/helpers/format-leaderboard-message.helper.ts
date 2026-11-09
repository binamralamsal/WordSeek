import { escapeHtml } from "#/core/format/escape-html.helper";
import { formatCommunityFooter } from "#/core/ui/format-community-footer.helper";
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  WordLength,
} from "#/types";

import { formatFilterSummary } from "./format-filters.helper";

const MEDALS = ["🥇", "🥈", "🥉"];

type LeaderboardFormatOptions = {
  /**
   * Show every player's Telegram user ID next to their name. Callers enable
   * this only for admins viewing a leaderboard in a private chat.
   */
  showUserIds?: boolean;
};

export function formatLeaderboardMessage(
  data: LeaderboardEntry[],
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength,
  options: LeaderboardFormatOptions = {},
) {
  const blocks: string[][] = [];

  data.forEach((entry, index) => {
    // First blockquote holds the podium, then ten players per blockquote.
    if (index === 0 || index === 3 || (index > 3 && (index - 3) % 10 === 0)) {
      blocks.push([]);
    }

    const rank = MEDALS[index] ?? "🔅";
    const displayName = entry.nickname?.trim() || entry.name;
    const name = entry.username
      ? `<a href="https://t.me/${escapeHtml(entry.username)}">${escapeHtml(
          displayName,
        )}</a>`
      : escapeHtml(displayName);
    const id = options.showUserIds
      ? ` <code>${escapeHtml(entry.userId)}</code>`
      : "";

    blocks[blocks.length - 1]!.push(
      `${rank} ${name}${id} — <b>${entry.totalScore.toLocaleString()}</b> pts`,
    );
  });

  const body =
    blocks.length > 0
      ? blocks
          .map((block) => `<blockquote>${block.join("<br>")}</blockquote>`)
          .join("\n")
      : `<blockquote>No scores for this filter yet. Pick another filter below, or start a game with /new.</blockquote>`;

  return `<h4>🏆 Leaderboard</h4>
<p><i>${formatFilterSummary(searchKey, timeKey, wordLength)}</i></p>
${body}
${formatCommunityFooter()}`;
}
