import type {
  LeaderboardPeriod,
  LeaderboardScope,
  WordLength,
} from "./leaderboard";
import type { ScoredGuess } from "./wordle";

export type { LeaderboardPeriod, LeaderboardScope, WordLength };

export const DAILY_ATTEMPTS = 6;
export const CLASSIC_ATTEMPTS = 30;

export type DailyStatus = "playing" | "won" | "lost";
export type ClassicStatus = "active" | "won" | "lost";

export type DailyWordDetails = {
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
};

export type MiniAppGuess = ScoredGuess;

export type MiniAppDailyState = {
  date: string;
  dayNumber: number;
  wordLength: 5;
  maxAttempts: typeof DAILY_ATTEMPTS;
  guesses: MiniAppGuess[];
  status: DailyStatus;
  solution: string | null;
  details: DailyWordDetails | null;
  streak: {
    current: number;
    highest: number;
  };
  /** True when the player submitted at least one guess from the bot chat. */
  startedInChat: boolean;
};

export type MiniAppClassicState = {
  id: number;
  wordLength: WordLength;
  maxAttempts: typeof CLASSIC_ATTEMPTS;
  guesses: MiniAppGuess[];
  status: ClassicStatus;
  solution: string | null;
  score: number | null;
  startedAt: string;
} | null;

export type MiniAppUser = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
};

export type MiniAppGroupContext = {
  chatId: string;
  title: string | null;
};

export type MiniAppProfileStats = {
  totalScore: number;
  classicGames: number;
  classicWins: number;
  bestScore: number;
  currentStreak: number;
  highestStreak: number;
  dailyPlayedToday: boolean;
  dailySolvedToday: boolean;
  memberSince: string;
};

export type MiniAppProfile = {
  user: MiniAppUser;
  stats: MiniAppProfileStats;
  group: MiniAppGroupContext | null;
};

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
  score: number;
  isMe: boolean;
};

export type LeaderboardPage = {
  rows: LeaderboardRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalPlayers: number;
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  wordLength: WordLength;
};

/** Public Mini App shape deliberately excludes Telegram user IDs. */
export type MiniAppLeaderboardPage = Omit<LeaderboardPage, "rows"> & {
  rows: Omit<LeaderboardRow, "userId">[];
};

export type MyRanking = {
  rank: number;
  score: number;
  gamesWon: number;
  bestScore: number;
  totalPlayers: number;
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  wordLength: WordLength;
} | null;

export type MiniAppBootstrap = {
  profile: MiniAppProfile;
  daily: MiniAppDailyState;
  classic: MiniAppClassicState;
  config: {
    dailyAttempts: typeof DAILY_ATTEMPTS;
    classicAttempts: typeof CLASSIC_ATTEMPTS;
    nickname: {
      minLength: number;
      maxLength: number;
    };
  };
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type ApiSuccess<T> = { data: T };
export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export type LeaderboardQuery = {
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  length: WordLength;
  page?: number;
  pageSize?: number;
};

export type NicknameUpdateResponse = {
  nickname: string;
  user: MiniAppUser;
};
