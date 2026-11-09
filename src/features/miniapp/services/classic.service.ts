import { db } from "#/config/db";
import { isUniqueViolation } from "#/core/database/errors.helper";
import { createLogger } from "#/core/logging/logger.service";
import type { MiniAppClassicState } from "#/shared/miniapp";
import { evaluateGuess } from "#/shared/wordle";
import { toDbWordLength, type WordLength } from "#/types";

import { WordSelector } from "../../wordle/regular/services/word-selector.service";
import { ALL_WORDS } from "../../wordle/shared/helpers/words.helper";

const log = createLogger("features.miniapp.services.classic.service");

export const CLASSIC_ATTEMPTS = 30;
const RESULT_VISIBLE_MS = 24 * 60 * 60 * 1000;
const selector = new WordSelector();

type ClassicGameRow = {
  id: number;
  userId: string;
  word: string;
  wordLength: string;
  chatId: string;
  status: string;
  attemptsUsed: number;
  score: number | null;
  startedAt: Date;
};

type ClassicGuessRow = { guess: string };

export type ClassicErrorCode =
  "GAME_NOT_FOUND" | "INVALID_WORD" | "DUPLICATE_GUESS" | "GAME_FINISHED";

export type ClassicResult =
  | { ok: true; state: MiniAppClassicState }
  | { ok: false; code: ClassicErrorCode; message: string };

function toState(
  game: ClassicGameRow,
  guesses: ClassicGuessRow[],
): NonNullable<MiniAppClassicState> {
  const finished = game.status !== "active";

  return {
    id: game.id,
    wordLength: Number(game.wordLength) as WordLength,
    maxAttempts: CLASSIC_ATTEMPTS,
    guesses: guesses.map((row) => ({
      guess: row.guess,
      states: evaluateGuess(row.guess, game.word),
    })),
    status: game.status as "active" | "won" | "lost",
    solution: finished ? game.word : null,
    score: game.score,
    startedAt: game.startedAt.toISOString(),
  };
}

async function getGuesses(gameId: number) {
  return await db
    .selectFrom("miniAppGuesses")
    .select(["guess", "attemptNumber"])
    .where("gameId", "=", gameId)
    .orderBy("attemptNumber", "asc")
    .execute();
}

async function findActiveGame(userId: string) {
  return await db
    .selectFrom("miniAppGames")
    .selectAll()
    .where("userId", "=", userId)
    .where("status", "=", "active")
    .executeTakeFirst();
}

/**
 * Returns the active game, or a game that finished in the last 24 hours so a
 * reload still shows the result and share card.
 */
export async function getClassicState(
  userId: string,
): Promise<MiniAppClassicState> {
  const active = await findActiveGame(userId);

  const game =
    active ??
    (await db
      .selectFrom("miniAppGames")
      .selectAll()
      .where("userId", "=", userId)
      .where("status", "!=", "active")
      .where("finishedAt", ">=", new Date(Date.now() - RESULT_VISIBLE_MS))
      .orderBy("finishedAt", "desc")
      .limit(1)
      .executeTakeFirst());

  if (!game) return null;

  return toState(game, await getGuesses(game.id));
}

export async function startClassicGame({
  userId,
  wordLength,
  chatId,
}: {
  userId: string;
  wordLength: WordLength;
  chatId: string;
}): Promise<MiniAppClassicState> {
  const active = await findActiveGame(userId);

  if (active) {
    return toState(active, await getGuesses(active.id));
  }

  const word = await selector.getRandomWord(`mini:${userId}`, wordLength);

  try {
    const game = await db
      .insertInto("miniAppGames")
      .values({
        userId,
        word,
        wordLength: toDbWordLength(wordLength),
        chatId,
        status: "active",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toState(game, []);
  } catch (error) {
    // Two openings raced through the partial unique index. The other request
    // already created the game, so return it instead of failing.
    if (isUniqueViolation(error)) {
      const game = await findActiveGame(userId);
      if (game) return toState(game, await getGuesses(game.id));
    }

    log.error({ err: error }, "Failed to start classic Mini App game");
    throw error;
  }
}

export async function abandonClassicGame(userId: string) {
  const game = await findActiveGame(userId);
  if (!game) return;

  await db
    .updateTable("miniAppGames")
    .set({
      status: "lost",
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where("id", "=", game.id)
    .where("status", "=", "active")
    .execute();
}

export async function submitClassicGuess(
  userId: string,
  rawGuess: string,
): Promise<ClassicResult> {
  const game = await findActiveGame(userId);

  if (!game) {
    return {
      ok: false,
      code: "GAME_NOT_FOUND",
      message: "Start a classic game first.",
    };
  }

  const wordLength = Number(game.wordLength) as WordLength;
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

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("miniAppGuesses")
      .values({
        gameId: game.id,
        guess,
        attemptNumber,
      })
      .execute();

    if (won) {
      // Matches the chat game: the winning guess itself is not deducted, so a
      // first-try solve is worth 30 and a 30th-try solve is worth 1.
      const score = Math.max(1, CLASSIC_ATTEMPTS - existing.length);

      await trx
        .insertInto("leaderboard")
        .values({
          userId,
          chatId: game.chatId,
          score,
          wordLength: toDbWordLength(wordLength),
        })
        .execute();
    }

    await trx
      .updateTable("miniAppGames")
      .set({
        attemptsUsed: attemptNumber,
        status: won ? "won" : lost ? "lost" : "active",
        score: won ? Math.max(1, CLASSIC_ATTEMPTS - existing.length) : null,
        finishedAt: won || lost ? new Date() : null,
        updatedAt: new Date(),
      })
      .where("id", "=", game.id)
      .where("status", "=", "active")
      .execute();
  });

  const updated = await db
    .selectFrom("miniAppGames")
    .selectAll()
    .where("id", "=", game.id)
    .executeTakeFirstOrThrow();

  return {
    ok: true,
    state: toState(updated, await getGuesses(game.id)),
  };
}
