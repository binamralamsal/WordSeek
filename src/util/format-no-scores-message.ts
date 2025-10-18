import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

type MessageContext = {
  isOwnScore: boolean;
  userName?: string;
  searchKey: AllowedChatSearchKey;
  timeKey: AllowedChatTimeKey;
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

  const subject = isOwnScore ? "You" : userName || "This user";
  const verbHave = isOwnScore ? "haven't" : "hasn't";
  const verb = isOwnScore ? "have" : "has";

  const scopeText = searchKey === "global" ? "globally" : "in this chat";

  const timeText: Record<AllowedChatTimeKey, string> = {
    today: "today",
    week: "this week",
    month: "this month",
    year: "this year",
    all: "yet",
  };

  // If user has no scores at all in the current scope
  if (!hasAnyScores) {
    if (searchKey === "group") {
      return `${subject} ${verb} no scores recorded in this chat. Try switching to "Global" to see ${isOwnScore ? "your" : "their"} overall scores.`;
    }
    return `${subject} ${verb} no scores recorded yet.${isOwnScore ? " Start playing to earn some points! 🎮" : ""}`;
  }

  // User has scores somewhere, but not in the current filter
  if (wasTimeKeyExplicit) {
    // User explicitly chose a time period
    if (timeKey === "all") {
      return `${subject} ${verb} no scores recorded ${scopeText}.`;
    }
    return `${subject} ${verbHave} played ${timeText[timeKey]} ${scopeText}. Try selecting a different time period to see ${isOwnScore ? "your" : "their"} scores.`;
  }

  // No explicit time key, but still no scores (edge case)
  return `${subject} ${verb} no scores recorded ${scopeText}. Try switching to "Global" or selecting a different time period.`;
}
