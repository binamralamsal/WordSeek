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
  const safeName = escapeHtmlEntities(data.name);

  const displayName = data.username
    ? `<a href="https://t.me/${escapeHtmlEntities(data.username)}">${safeName}</a>`
    : safeName;

  const scopeText = searchKey === "global" ? "Globally" : "In This Chat";

  return [
    `<blockquote>🏆 <b>${displayName}'s Performance ${scopeText}</b> 🏆</blockquote>`,
    ``,
    `📊 <b>Total Score:</b> ${data.totalScore.toLocaleString()}`,
    `🏅 <b>Rank:</b> #${data.rank.toLocaleString()}`,
    ``,
    FOOTER_MESSAGE,
  ].join("\n");
}
