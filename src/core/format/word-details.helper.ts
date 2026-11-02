import { escapeHtml } from "./escape-html.helper";

interface WordDetailsInput {
  word: string;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
}

function renderWordDetails(
  input: WordDetailsInput,
  escape = true,
  separator = "<br>",
) {
  const { word, meaning, phonetic, sentence } = input;

  const parts: string[] = [];

  parts.push(`<strong>Correct Word: ${escapeHtml(word)}</strong>`);

  if (phonetic) {
    parts.push(
      `<strong>${escapeHtml(capitalizeFirstLetter(word))}</strong> <code>${escapeHtml(phonetic)}</code>`,
    );
  }

  if (meaning) {
    parts.push(
      `<strong>Meaning</strong>: ${escape ? escapeHtml(meaning) : meaning}`,
    );
  }

  if (sentence) {
    parts.push(`<strong>Example</strong>: ${escapeHtml(sentence)}`);
  }

  return `<blockquote>${parts.join(separator)}</blockquote>`;
}

export function formatDailyWordDetails(
  data: WordDetailsInput,
  separator = "<br>",
) {
  return renderWordDetails(
    {
      word: data.word,
      meaning: data.meaning,
      phonetic: data.phonetic,
      sentence: data.sentence,
    },
    false,
    separator,
  );
}

function capitalizeFirstLetter(string: string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}
