import { escapeHtml } from "#/core/format/escape-html.helper";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

import {
  formatFilterSummary,
  formatScopeSentence,
} from "./format-filters.helper";

type FormatUserScoreData = {
  totalScore: number;
  rank: number;
  name: string;
  username: string | null;
  currentStreak: number | null;
  highestStreak: number | null;
};

export function formatUserScoreMessage(
  data: FormatUserScoreData,
  searchKey: LeaderboardScope,
  timeKey: LeaderboardPeriod,
  wordLength: WordLength,
) {
  const name = escapeHtml(data.name);
  const mentionLink = data.username
    ? `<a href="https://t.me/${escapeHtml(data.username)}">${name}</a>`
    : name;

  const totalScore = data.totalScore.toLocaleString();
  const rank = data.rank.toLocaleString();

  const currentStreak =
    data.currentStreak !== null ? data.currentStreak.toString() : "0";
  const highestStreak =
    data.highestStreak !== null ? data.highestStreak.toString() : "0";

  return `<h3>📊 Score Report</h3>
<p><b>${mentionLink}</b></p>
<p><i>${formatFilterSummary(searchKey, timeKey, wordLength)}</i></p>

<table bordered striped compact>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td align="left">Points ${formatScopeSentence(searchKey)}</td><td align="right"><b>${totalScore}</b></td></tr>
<tr><td align="left">Rank</td><td align="right"><b>#${rank}</b></td></tr>
<tr><td align="left">Current streak</td><td align="right">🔥 ${currentStreak} days</td></tr>
<tr><td align="left">Best streak</td><td align="right">⭐ ${highestStreak} days</td></tr>
</table>

<footer>Daily WordSeek streaks are tracked per user, across chats.</footer>`;
}
