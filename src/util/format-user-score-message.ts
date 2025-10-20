import { FOOTER_MESSAGE } from "../config/constants";
import { AllowedChatSearchKey } from "../types";
import { escapeHtmlEntities } from "./escape-html-entities";

type FormatUserScoreData = {
  totalScore: number;
  rank: number;
  name: string;
  username: string | null;
};

export function formatUserScoreMessage(
  data: FormatUserScoreData,
  searchKey: AllowedChatSearchKey,
) {
  const name = escapeHtmlEntities(data.name);
  const mentionLink = data.username
    ? `<a href="t.me/${data.username}">${name}'s</a>`
    : `${name}'s`;

  const message = `<blockquote><strong>🏆 ${mentionLink} total score ${
    searchKey === "global" ? "globally" : "in this chat"
  } is ${data.totalScore.toLocaleString()}, and rank is ${data.rank.toLocaleString()} 🏆</strong></blockquote>`;

  return `${message}\n\n${FOOTER_MESSAGE}`;
}
