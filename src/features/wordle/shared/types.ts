export type LetterState = "correct" | "present" | "absent";

export type GuessEntry = {
  id: number;
  guess: string;
  gameId?: number;
  dailyWordId?: number;
  attemptNumber?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DailyWord = {
  date: Date;
  dayNumber: number;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
  word: string;
};
