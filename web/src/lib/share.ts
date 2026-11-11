import type { MiniAppClassicState, MiniAppDailyState } from "@shared/miniapp";

const stateEmoji: Record<string, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
};

function guessGrid(guesses: Array<{ states: string[] }>, maxRows = 6): string {
  const rows = guesses
    .slice(0, maxRows)
    .map((guess) =>
      guess.states.map((state) => stateEmoji[state] ?? "⬛").join(""),
    );

  if (guesses.length > maxRows) {
    rows.push(`… +${guesses.length - maxRows} more`);
  }

  return rows.join("\n");
}

export function buildResultShareText(
  kind: "daily" | "classic",
  state: Exclude<MiniAppDailyState | MiniAppClassicState, null>,
): string {
  const won = state.status === "won";
  const grid = guessGrid(state.guesses);

  if (kind === "daily") {
    const daily = state as MiniAppDailyState;
    return [
      `WordSeek Daily #${daily.dayNumber} ${won ? `${daily.guesses.length}/6` : "X/6"}`,
      "",
      grid,
      "",
      won
        ? `🔥 ${daily.streak.current} day streak`
        : "Tomorrow is another chance.",
    ].join("\n");
  }

  const classic = state as NonNullable<MiniAppClassicState>;
  return [
    `WordSeek Classic · ${classic.wordLength} letters`,
    won
      ? `Solved in ${classic.guesses.length}/30${classic.score != null ? ` · +${classic.score} points` : ""}`
      : `Not this time · ${classic.guesses.length}/30 guesses`,
    "",
    grid,
  ].join("\n");
}
