import { escapeHtml } from "#/core/format/escape-html.helper";
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
  WordLength,
} from "#/types";

import { formatFilterSummary, formatScopeLabel } from "./format-filters.helper";

const MEDALS = ["🥇", "🥈", "🥉"];

export function formatLeaderboardMessage(
  data: LeaderboardEntry[],
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength,
) {
  const heading = `🏆 ${formatScopeLabel(searchKey)} Leaderboard`;

  const rows = data
    .map((entry, index) => {
      const rank = MEDALS[index] ?? `<b>#${index + 1}</b>`;

      const name = entry.username
        ? `<a href="https://t.me/${escapeHtml(entry.username)}">${escapeHtml(
            entry.name,
          )}</a>`
        : escapeHtml(entry.name);

      return `<tr><td align="center">${rank}</td><td align="left">${name}</td><td align="right"><b>${entry.totalScore.toLocaleString()}</b></td></tr>`;
    })
    .join("");

  const body =
    data.length > 0
      ? `<table bordered striped compact>
<tr><th>#</th><th>Player</th><th>Points</th></tr>
${rows}
</table>`
      : `<blockquote>No scores for this filter yet. Pick another filter below, or start a game with /new.</blockquote>`;

  return `<h3>${heading}</h3>
<p><i>${formatFilterSummary(searchKey, timeKey, wordLength)}</i></p>
${body}`;
}
