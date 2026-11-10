import { db } from "#/config/db";
import { isUniqueViolation } from "#/core/database/errors.helper";
import { createLogger } from "#/core/logging/logger.service";
import type { MiniAppClassicState } from "#/shared/miniapp";
import { evaluateGuess } from "#/shared/wordle";
import { toDbWordLength, type WordLength } from "#/types";

import { WordSelector } from "../../wordle/regular/services/word-selector.service";
import { ALL_WORDS } from "../../wordle/shared/helpers/words.helper";
import { recordClassicWin } from "../../wordle/shared/services/game-stats.service";

const log = createLogger("features.miniapp.services.classic.service");

export const CLASSIC_ATTEMPTS = 30;
const MINIAPP_TOPIC_PREFIX = "classic:";
const selector = new WordSelector();

type ClassicGameRow = {
  id: number;
  activeChat: string;
  word: string;
  createdAt: Date;
};

type ClassicGuessRow = { guess: string; createdAt: Date };

export type ClassicErrorCode =
  "GAME_NOT_FOUND" | "INVALID_WORD" | "DUPLICATE_GUESS";

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
  status: NonNullable<MiniAppClassicState>["status"] = "active",
): NonNullable<MiniAppClassicState> {
  const wordLength = game.word.length as WordLength;
  const won = status === "won";

  return {
    id: game.id,
    wordLength,
    maxAttempts: CLASSIC_ATTEMPTS,
    guesses: guesses.map((row) => ({
      guess: row.guess,
      states: evaluateGuess(row.guess, game.word),
    })),
    status,
    solution: status === "active" ? null : game.word,
    score: won ? Math.max(1, CLASSIC_ATTEMPTS - guesses.length + 1) : null,
    startedAt: game.createdAt.toISOString(),
  };
}

async function getGuesses(gameId: number) {
  return await db
    .selectFrom("guesses")
    .select(["guess", "createdAt"])
    .where("gameId", "=", gameId)
    .orderBy("createdAt", "asc")
    .orderBy("id", "asc")
    .execute();
}

async function findActiveGame(userId: string, wordLength: WordLength) {
  return await db
    .selectFrom("games")
    .selectAll()
    .where("source", "=", "miniapp")
    .where("activeChat", "=", playerGameKey(userId))
    .where("topicId", "=", topicForLength(wordLength))
    .executeTakeFirst();
}

/** Returns the selected length's active game, if one exists. */
export async function getClassicState(
  userId: string,
  wordLength: WordLength = 5,
): Promise<MiniAppClassicState> {
  const active = await findActiveGame(userId, wordLength);
  if (!active) return null;
  return toState(active, await getGuesses(active.id));
}

/** Loads all existing lengths so switching tabs never creates a game row. */
export async function getClassicStates(
  userId: string,
): Promise<Record<WordLength, MiniAppClassicState>> {
  const result: Record<WordLength, MiniAppClassicState> = {
    4: null,
    5: null,
    6: null,
  };
  const games = await db
    .selectFrom("games")
    .selectAll()
    .where("source", "=", "miniapp")
    .where("activeChat", "=", playerGameKey(userId))
    .where("topicId", "in", ["classic:4", "classic:5", "classic:6"])
    .execute();

  if (!games.length) return result;

  const guesses = await db
    .selectFrom("guesses")
    .select(["gameId", "guess", "createdAt"])
    .where(
      "gameId",
      "in",
      games.map((game) => game.id),
    )
    .orderBy("createdAt", "asc")
    .orderBy("id", "asc")
    .execute();
  const guessesByGame = new Map<number, ClassicGuessRow[]>();

  for (const guess of guesses) {
    const list = guessesByGame.get(guess.gameId) ?? [];
    list.push(guess);
    guessesByGame.set(guess.gameId, list);
  }

  for (const game of games) {
    const length = game.word.length as WordLength;
    result[length] = toState(game, guessesByGame.get(game.id) ?? []);
  }

  return result;
}

/** Switching lengths reuses that length's active game. */
export async function startClassicGame({
  userId,
  wordLength,
}: {
  userId: string;
  wordLength: WordLength;
}): Promise<NonNullable<MiniAppClassicState>> {
  const active = await findActiveGame(userId, wordLength);
  if (active) return toState(active, await getGuesses(active.id));

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

  await db.deleteFrom("games").where("id", "=", game.id).execute();
}

export async function submitClassicGuess(
  userId: string,
  rawGuess: string,
  wordLength: WordLength,
): Promise<ClassicResult> {
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

  let game:
    NonNullable<Awaited<ReturnType<typeof findActiveGame>>> | undefined =
    await findActiveGame(userId, wordLength);
  if (!game) {
    await startClassicGame({ userId, wordLength });
    game = await findActiveGame(userId, wordLength);
  }
  if (!game) throw new Error("Classic game could not be created.");

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
  const nextGuesses = [...existing, { guess, createdAt: new Date() }];
  const status = won ? "won" : lost ? "lost" : "active";

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("guesses")
      .values({
        gameId: game.id,
        chatId: game.activeChat,
        guess,
      })
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
      await recordClassicWin(trx, userId);
    }

    if (won || lost) {
      await trx.deleteFrom("games").where("id", "=", game.id).execute();
    }
  });

  const state = toState(game, nextGuesses, status);
  return { ok: true, state };
}
