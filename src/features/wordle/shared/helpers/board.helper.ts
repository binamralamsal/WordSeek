import { randomInt } from "node:crypto";

import { evaluateGuess, type LetterState } from "#/shared/wordle";

import type { GuessEntry } from "../types";

export { evaluateGuess };

const BUTTON_STYLE: Record<LetterState, string | null> = {
  correct: "success",
  present: null,
  absent: "danger",
};

const HINT_TEXT: Record<LetterState, (letter: string) => string> = {
  correct: (l) => `🟩 "${l}" is in the word and in the right spot.`,
  present: (l) => `🟨 "${l}" is in the word, but in a different spot.`,
  absent: (l) => `🟥 "${l}" isn't in the word.`,
};

const ZERO_WIDTH = [
  "\u200B", // zero width space
  "\u200C", // zero width non-joiner
  "\u200D", // zero width joiner
  "\u2060", // word joiner
  "\uFEFF", // zero width no-break space
];

function zeroWidthNoise(min = 1, max = 6): string {
  const count = randomInt(min, max + 1);
  let out = "";
  for (let i = 0; i < count; i++) {
    out += ZERO_WIDTH[randomInt(ZERO_WIDTH.length)];
  }
  return out;
}

export function getHint(state: string, letter: string): string {
  const hint = HINT_TEXT[state as LetterState];
  return hint ? hint(letter) : "Unknown hint.";
}

export function renderGuessRow(guess: string, solution: string): string {
  const states = evaluateGuess(guess, solution);

  const buttons = guess
    .toUpperCase()
    .split("")
    .map((letter, i) => {
      const state = states[i]!;
      const style = BUTTON_STYLE[state];
      const styleAttr = style ? ` style="${style}"` : "";
      const label = `${zeroWidthNoise()}${letter}${zeroWidthNoise()}`;
      return `<tg-button type="callback_data"${styleAttr} data="wh:${state}:${letter}">${label}</tg-button>`;
    })
    .join("");

  return `<p>${buttons}</p>`;
}

export function buildRichFeedback(
  guesses: GuessEntry[],
  solution: string,
  modeLabel: string,
): string {
  const rows = guesses.map((g) => renderGuessRow(g.guess, solution)).join("");

  return `<h3>${modeLabel}</h3><p><i>${guesses.length}/30 guesses</i></p>${rows}`;
}
