import commonWords from "../data/commonWords.json";
import { escapeHtmlEntities } from "./escape-html-entities";

interface WordDetailsInput {
  word: string;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
}

function renderWordDetails(input: WordDetailsInput, escape = true) {
  const { word, meaning, phonetic, sentence } = input;

  const parts: string[] = [];

  parts.push(`<strong>Correct Word: ${escapeHtmlEntities(word)}</strong>`);

  if (phonetic) {
    parts.push(
      `<strong>${escapeHtmlEntities(capitalizeFirstLetter(word))}</strong> <code>${escapeHtmlEntities(phonetic)}</code>`,
    );
  }

  if (meaning) {
    parts.push(
      `<strong>Meaning</strong>: ${
        escape ? escapeHtmlEntities(meaning) : meaning
      }`,
    );
  }

  if (sentence) {
    parts.push(`<strong>Example</strong>: ${escapeHtmlEntities(sentence)}`);
  }

  return `<blockquote>${parts.join("\n")}</blockquote>`;
}

export function formatWordDetails(word: string) {
  const wordDetails = commonWords[word] ?? {
    meaning: null,
    pronunciation: null,
    example: null,
  };

  return renderWordDetails({
    word,
    meaning: wordDetails.meaning,
    phonetic: wordDetails.pronunciation,
    sentence: wordDetails.example,
  });
}

export function formatDailyWordDetails(data: WordDetailsInput) {
  return renderWordDetails(
    {
      word: data.word,
      meaning: data.meaning,
      phonetic: data.phonetic,
      sentence: data.sentence,
    },
    false,
  );
}

function capitalizeFirstLetter(string: string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}
