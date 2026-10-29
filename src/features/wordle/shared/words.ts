import type { WordLength } from "#/types";
import allSixWords from "#/data/all-six.json";
import allFiveWords from "#/data/all-five.json";
import allFourWords from "#/data/all-four.json";

export const ALL_WORDS: Record<WordLength, string[]> = {
  4: allFourWords,
  5: allFiveWords,
  6: allSixWords,
};

export const MODE_LABEL: Record<WordLength, string> = {
  4: "4-letter mode",
  5: "5-letter mode",
  6: "6-letter mode",
};
