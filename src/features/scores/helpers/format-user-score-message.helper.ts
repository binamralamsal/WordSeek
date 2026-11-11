import { escapeHtml } from "#/core/format/escape-html.helper";
import { formatCommunityLinks } from "#/core/ui/format-community-footer.helper";
import type { LeaderboardPeriod, LeaderboardScope, WordLength } from "#/types";

import {
  formatFilterSummary,
  formatScopeSentence,
} from "./format-filters.helper";

type FormatUserScoreData = {
  totalScore: number;
  rank: number;
  name: string;
  nickname?: string | null;
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
  const name = escapeHtml(data.nickname?.trim() || data.name);

  const totalScore = data.totalScore.toLocaleString();
  const rank = data.rank.toLocaleString();

  const currentStreak =
    data.currentStreak !== null ? data.currentStreak.toString() : "0";
  const highestStreak =
    data.highestStreak !== null ? data.highestStreak.toString() : "0";

  return `<h4>📊 Score Report · ${name}</h4>
<p><i>${formatFilterSummary(searchKey, timeKey, wordLength)}</i></p>

<blockquote><b>🏅 Rank</b> #${rank}<br><b>⭐ Points</b> ${totalScore} ${formatScopeSentence(searchKey)}</blockquote>
<blockquote><b>🔥 Current streak</b> ${currentStreak} days<br><b>🏆 Best streak</b> ${highestStreak} days</blockquote>

<footer>${formatCommunityLinks()}</footer>`;
}
