import { escapeHtml } from "#/core/format/escape-html.helper";
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  WordLength,
} from "#/types";

import { formatCommunityFooter } from "./format-community-footer.helper";
import { formatFilterSummary, formatScopeLabel } from "./format-filters.helper";

const MEDALS = ["🥇", "🥈", "🥉"];

export function formatLeaderboardMessage(
  data: LeaderboardEntry[],
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength,
) {
  const blocks: string[][] = [];

  data.forEach((entry, index) => {
    // First blockquote holds the podium, then ten players per blockquote.
    if (index === 0 || index === 3 || (index > 3 && (index - 3) % 10 === 0)) {
      blocks.push([]);
    }

    const rank = MEDALS[index] ?? `<b>#${index + 1}</b>`;
    const name = entry.username
      ? `<a href="https://t.me/${escapeHtml(entry.username)}">${escapeHtml(
          entry.name,
        )}</a>`
      : escapeHtml(entry.name);

    blocks[blocks.length - 1]!.push(
      `${rank} ${name} — <b>${entry.totalScore.toLocaleString()}</b> pts`,
    );
  });

  const body =
    blocks.length > 0
      ? blocks
          .map((block) => `<blockquote>${block.join("<br>")}</blockquote>`)
          .join("\n")
      : `<blockquote>No scores for this filter yet. Pick another filter below, or start a game with /new.</blockquote>`;

  return `<h4>🏆 ${formatScopeLabel(searchKey)} Leaderboard</h4>
<p><i>${formatFilterSummary(searchKey, timeKey, wordLength)}</i></p>
${body}
${formatCommunityFooter()}`;
}
