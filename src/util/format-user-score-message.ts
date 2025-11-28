import { FOOTER_MESSAGE } from "../config/constants";
import { AllowedChatSearchKey } from "../types";
import { escapeHtmlEntities } from "./escape-html-entities";

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
  searchKey: AllowedChatSearchKey,
) {
  const name = escapeHtmlEntities(data.name);
  const mentionLink = data.username
    ? `<a href="https://t.me/${data.username}">${name}</a>`
    : name;

  const scopeText = searchKey === "global" ? "globally" : "in this chat";

  const totalScore = data.totalScore.toLocaleString();
  const rank = data.rank.toLocaleString();

  const currentStreak =
    data.currentStreak !== null ? data.currentStreak.toString() : "0";
  const highestStreak =
    data.highestStreak !== null ? data.highestStreak.toString() : "0";

  return `
<blockquote><strong>🏆 Regular WordSeek Scores</strong></blockquote>
<b>${mentionLink}</b> has a total score of <b>${totalScore}</b> ${scopeText}.
Their rank is <b>#${rank}</b>.

<blockquote><strong>🔥 Daily WordSeek Stats</strong></blockquote>
<b>Current Streak:</b> ${currentStreak} days
<b>Highest Streak:</b> ${highestStreak} days

${FOOTER_MESSAGE}
  `.trim();
}
