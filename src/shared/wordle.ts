export type LetterState = "correct" | "present" | "absent";

export type ScoredGuess = {
  guess: string;
  states: LetterState[];
};

const SHARE_EMOJI: Record<LetterState, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
};

/**
 * Wordle scoring. Present letters are only awarded while a matching letter is
 * still unused, which keeps duplicate letters correct ("SPEED" with one E in
 * the answer reports a single yellow E).
 */
export function evaluateGuess(guess: string, solution: string): LetterState[] {
  const g = guess.toUpperCase();
  const s = solution.toUpperCase();

  const remaining: Record<string, number> = {};
  for (const char of s) remaining[char] = (remaining[char] ?? 0) + 1;

  const result: LetterState[] = Array.from(
    { length: g.length },
    () => "absent",
  );

  for (let index = 0; index < g.length; index++) {
    if (g[index] === s[index]) {
      result[index] = "correct";
      remaining[g[index]!] = (remaining[g[index]!] ?? 0) - 1;
    }
  }

  for (let index = 0; index < g.length; index++) {
    const char = g[index]!;
    if (result[index] === "absent" && (remaining[char] ?? 0) > 0) {
      result[index] = "present";
      remaining[char] = (remaining[char] ?? 0) - 1;
    }
  }

  return result;
}

const STATE_PRIORITY: Record<LetterState, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

/** Merges a new letter state into the on-screen keyboard state. */
export function mergeLetterState(
  previous: LetterState | undefined,
  next: LetterState,
): LetterState {
  if (!previous) return next;
  return STATE_PRIORITY[next] > STATE_PRIORITY[previous] ? next : previous;
}

export function computeKeyboardStates(
  guesses: ScoredGuess[],
): Record<string, LetterState> {
  const states: Record<string, LetterState> = {};

  for (const entry of guesses) {
    const letters = entry.guess.toUpperCase().split("");
    letters.forEach((letter, index) => {
      const state = entry.states[index];
      if (state) states[letter] = mergeLetterState(states[letter], state);
    });
  }

  return states;
}

export function formatShareGrid(
  guesses: ScoredGuess[],
  options: { title: string; totalAttempts?: number } = { title: "WordSeek" },
): string {
  const lines = guesses.map((entry) =>
    entry.states.map((state) => SHARE_EMOJI[state]).join(""),
  );

  const attemptSuffix = options.totalAttempts
    ? ` ${guesses.length}/${options.totalAttempts}`
    : ` ${guesses.length}`;

  return `${options.title}${attemptSuffix}\n\n${lines.join("\n")}`;
}
