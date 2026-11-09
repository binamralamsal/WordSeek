import { db } from "#/config/db";
import { isUniqueViolation } from "#/core/database/errors.helper";
import { createLogger } from "#/core/logging/logger.service";
import type { MiniAppClassicState } from "#/shared/miniapp";
import { evaluateGuess } from "#/shared/wordle";
import { toDbWordLength, type WordLength } from "#/types";

import { WordSelector } from "../../wordle/regular/services/word-selector.service";
import { ALL_WORDS } from "../../wordle/shared/helpers/words.helper";
import { recordClassicResult } from "../../wordle/shared/services/game-stats.service";

const log = createLogger("features.miniapp.services.classic.service");

export const CLASSIC_ATTEMPTS = 30;
const RESULT_VISIBLE_MS = 24 * 60 * 60 * 1000;
const MINIAPP_TOPIC_PREFIX = "classic:";
const selector = new WordSelector();

type ClassicGameRow = {
  id: number;
  startedBy: string | null;
  activeChat: string;
  topicId: string;
  word: string;
  gameStatus: string;
  attemptsUsed: number;
  score: number | null;
  createdAt: Date;
  finishedAt: Date | null;
};

type ClassicGuessRow = { guess: string; attemptNumber: number | null };

export type ClassicErrorCode =
  "GAME_NOT_FOUND" | "INVALID_WORD" | "DUPLICATE_GUESS" | "GAME_FINISHED";

export type ClassicResult =
  | { ok: true; state: NonNullable<MiniAppClassicState> }
  | { ok: false; code: ClassicErrorCode; message: string };

function playerGameKey(userId: string) {
  return `miniapp:${userId}`;
}

function topicForLength(wordLength: WordLength) {
  return `${MINIAPP_TOPIC_PREFIX}${wordLength}`;
}

function toState(
  game: ClassicGameRow,
  guesses: ClassicGuessRow[],
): NonNullable<MiniAppClassicState> {
  const finished = game.gameStatus !== "active";
  const wordLength = game.word.length as WordLength;

  return {
    id: game.id,
    wordLength,
    maxAttempts: CLASSIC_ATTEMPTS,
    guesses: guesses.map((row) => ({
      guess: row.guess,
      states: evaluateGuess(row.guess, game.word),
    })),
    status: game.gameStatus as "active" | "won" | "lost",
    solution: finished ? game.word : null,
    score: game.score,
    startedAt: game.createdAt.toISOString(),
  };
}

async function getGuesses(gameId: number) {
  return await db
    .selectFrom("guesses")
    .select(["guess", "attemptNumber"])
    .where("gameId", "=", gameId)
    .orderBy("attemptNumber", "asc")
    .orderBy("createdAt", "asc")
    .execute();
}

async function findActiveGame(userId: string, wordLength: WordLength) {
  return await db
    .selectFrom("games")
    .selectAll()
    .where("source", "=", "miniapp")
    .where("activeChat", "=", playerGameKey(userId))
    .where("topicId", "=", topicForLength(wordLength))
    .where("gameStatus", "=", "active")
    .executeTakeFirst();
}

/** Returns the selected length's active game or its recent completed result. */
export async function getClassicState(
  userId: string,
  wordLength: WordLength = 5,
): Promise<MiniAppClassicState> {
  const active = await findActiveGame(userId, wordLength);
  const game =
    active ??
    (await db
      .selectFrom("games")
      .selectAll()
      .where("source", "=", "miniapp")
      .where("activeChat", "=", playerGameKey(userId))
      .where("topicId", "=", topicForLength(wordLength))
      .where("gameStatus", "!=", "active")
      .where("finishedAt", ">=", new Date(Date.now() - RESULT_VISIBLE_MS))
      .orderBy("finishedAt", "desc")
      .limit(1)
      .executeTakeFirst());

  if (!game) return null;
  return toState(game, await getGuesses(game.id));
}

/** Switching lengths reuses that length's active game, without closing others. */
export async function startClassicGame({
  userId,
  wordLength,
}: {
  userId: string;
  wordLength: WordLength;
}): Promise<NonNullable<MiniAppClassicState>> {
  const active = await findActiveGame(userId, wordLength);
  if (active) return toState(active, await getGuesses(active.id));

  await db
    .deleteFrom("games")
    .where("source", "=", "miniapp")
    .where("activeChat", "=", playerGameKey(userId))
    .where("gameStatus", "!=", "active")
    .where("updatedAt", "<", new Date(Date.now() - RESULT_VISIBLE_MS))
    .execute();

  const word = await selector.getRandomWord(
    `${playerGameKey(userId)}:${wordLength}`,
    wordLength,
  );

  try {
    const game = await db
      .insertInto("games")
      .values({
        activeChat: playerGameKey(userId),
        topicId: topicForLength(wordLength),
        startedBy: userId,
        source: "miniapp",
        gameStatus: "active",
        attemptsUsed: 0,
        score: null,
        finishedAt: null,
        word,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toState(game, []);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const racedGame = await findActiveGame(userId, wordLength);
      if (racedGame) return toState(racedGame, await getGuesses(racedGame.id));
    }

    log.error({ err: error }, "Failed to start classic Mini App game");
    throw error;
  }
}

export async function abandonClassicGame(
  userId: string,
  wordLength: WordLength,
) {
  const game = await findActiveGame(userId, wordLength);
  if (!game) return;

  await db
    .updateTable("games")
    .set({ gameStatus: "lost", finishedAt: new Date() })
    .where("id", "=", game.id)
    .where("gameStatus", "=", "active")
    .execute();
}

export async function submitClassicGuess(
  userId: string,
  rawGuess: string,
  wordLength: WordLength,
): Promise<ClassicResult> {
  const game = await findActiveGame(userId, wordLength);

  if (!game) {
    return {
      ok: false,
      code: "GAME_NOT_FOUND",
      message: "Start a classic game first.",
    };
  }

  const guess = rawGuess.trim().toLowerCase();
  if (
    guess.length !== wordLength ||
    !/^[a-z]+$/.test(guess) ||
    !ALL_WORDS[wordLength].includes(guess)
  ) {
    return {
      ok: false,
      code: "INVALID_WORD",
      message: `${rawGuess.toUpperCase()} is not a valid ${wordLength}-letter word.`,
    };
  }

  const existing = await getGuesses(game.id);
  if (existing.some((row) => row.guess === guess)) {
    return {
      ok: false,
      code: "DUPLICATE_GUESS",
      message: "You've already guessed this word. Try another one!",
    };
  }

  const attemptNumber = existing.length + 1;
  const won = guess === game.word;
  const lost = !won && attemptNumber >= CLASSIC_ATTEMPTS;
  const score = won ? Math.max(1, CLASSIC_ATTEMPTS - existing.length) : null;

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("guesses")
      .values({
        gameId: game.id,
        chatId: game.activeChat,
        userId,
        attemptNumber,
        guess,
      })
      .execute();

    await trx
      .updateTable("games")
      .set({
        attemptsUsed: attemptNumber,
        gameStatus: won ? "won" : lost ? "lost" : "active",
        score,
        finishedAt: won || lost ? new Date() : null,
      })
      .where("id", "=", game.id)
      .where("gameStatus", "=", "active")
      .execute();

    if (won) {
      await trx
        .insertInto("leaderboard")
        .values({
          userId,
          chatId: userId,
          score: score!,
          wordLength: toDbWordLength(wordLength),
        })
        .execute();
      await recordClassicResult(trx, userId, "won", score!);
    } else if (lost) {
      await recordClassicResult(trx, userId, "lost", 0);
    }
  });

  const updated = await db
    .selectFrom("games")
    .selectAll()
    .where("id", "=", game.id)
    .executeTakeFirstOrThrow();

  return { ok: true, state: toState(updated, await getGuesses(game.id)) };
}
