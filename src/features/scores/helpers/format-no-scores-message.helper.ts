import { escapeHtml } from "#/core/format/escape-html.helper";
import type { LeaderboardPeriod, LeaderboardScope } from "#/types";

type MessageContext = {
  isOwnScore: boolean;
  userName?: string;
  searchKey: LeaderboardScope;
  timeKey: LeaderboardPeriod;
  wasTimeKeyExplicit: boolean;
  hasAnyScores: boolean;
};

export function formatNoScoresMessage(context: MessageContext): string {
  const {
    isOwnScore,
    userName,
    searchKey,
    timeKey,
    wasTimeKeyExplicit,
    hasAnyScores,
  } = context;

  const subject = isOwnScore ? "You" : escapeHtml(userName || "This user");
  const verbHave = isOwnScore ? "haven't" : "hasn't";
  const verb = isOwnScore ? "have" : "has";

  const scopeText = searchKey === "global" ? "globally" : "in this chat";

  const timeText: Record<LeaderboardPeriod, string> = {
    today: "today",
    week: "this week",
    month: "this month",
    year: "this year",
    all: "yet",
  };

  let text: string;

  // If user has no scores at all in the current scope
  if (!hasAnyScores) {
    if (searchKey === "group") {
      text = `${subject} ${verb} no scores recorded in this chat. Try switching to "Global" to see ${isOwnScore ? "your" : "their"} overall scores.`;
    } else {
      text = `${subject} ${verb} no scores recorded yet.${isOwnScore ? " Start playing to earn some points! 🎯" : ""}`;
    }
  } else if (wasTimeKeyExplicit) {
    // User has scores somewhere, but not in the current filter
    if (timeKey === "all") {
      text = `${subject} ${verb} no scores recorded ${scopeText}.`;
    } else {
      text = `${subject} ${verbHave} played ${timeText[timeKey]} ${scopeText}. Try selecting a different time period to see ${isOwnScore ? "your" : "their"} scores.`;
    }
  } else {
    // No explicit time key, but still no scores (edge case)
    text = `${subject} ${verb} no scores recorded ${scopeText}. Try switching to "Global" or selecting a different time period.`;
  }

  return `<h3>🔍 No Scores Found</h3>
<blockquote>${text}</blockquote>
<p><i>Use the buttons below to change the scope, period or word length.</i></p>`;
}
