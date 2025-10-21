import commonWords from "../data/commonWords.json";
import { escapeHtmlEntities } from "./escape-html-entities";

export function formatWordDetails(word: string) {
  const wordDetails = commonWords[word];

  return `<blockquote><strong>Correct Word: ${word}</strong>
<strong>${escapeHtmlEntities(capitalizeFirstLetter(word))}</strong> <code>${
    escapeHtmlEntities(wordDetails.pronunciation) || ""
  }</code>
${
  wordDetails.meaning
    ? `<strong>Meaning</strong>: ${escapeHtmlEntities(wordDetails.meaning)}`
    : ""
}
${
  wordDetails.example
    ? `<strong>Example</strong>: ${escapeHtmlEntities(wordDetails.example)}`
    : ""
}</blockquote>`;
}

function capitalizeFirstLetter(string: string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}
