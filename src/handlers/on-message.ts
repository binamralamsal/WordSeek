import { Composer } from "grammy";

import { and, asc, eq } from "drizzle-orm";

import allWords from "../data/allWords.json";
import commonWords from "../data/commonWords.json";
import { db } from "../drizzle/db";
import {
  gamesTable,
  guessesTable,
  leaderboardTable,
  usersTable,
} from "../drizzle/schema";
import { formatWordDetails } from "../util/format-word-details";

const composer = new Composer();

composer.on("message", async (ctx) => {
  const currentGuess = ctx.message.text?.toLowerCase();
  if (
    !currentGuess ||
    currentGuess.length !== 5 ||
    currentGuess.startsWith("/")
  )
    return;

  const currentGame = await db.query.gamesTable.findFirst({
    where: eq(gamesTable.activeChat, String(ctx.chat.id)),
  });

  if (!currentGame) return;

  if (
    !allWords.includes(currentGuess) &&
    !Object.keys(commonWords).includes(currentGuess)
  )
    return ctx.reply(`${currentGuess} is not a valid word.`);

  const guessExists = await db.query.guessesTable.findFirst({
    where: and(
      eq(guessesTable.guess, currentGuess),
      eq(guessesTable.chatId, ctx.chat.id.toString()),
    ),
  });

  if (guessExists)
    return ctx.reply(
      "Someone has already guessed your word. Please try another one!",
    );

  if (currentGuess === currentGame.word) {
    const allGuesses = await db.query.guessesTable.findMany({
      where: eq(guessesTable.gameId, currentGame.id),
    });

    const name = `${ctx.from.first_name}${
      ctx.from.last_name ? " " + ctx.from.last_name : ""
    }`;
    const username = ctx.from.username;
    const userId = ctx.from.id.toString();
    const chatId = ctx.chat.id.toString();

    const score = 30 - allGuesses.length;
    const additionalMessage = `Added ${
      30 - allGuesses.length
    } to the leaderboard.`;

    const [dbUser] = await db
      .insert(usersTable)
      .values({
        name,
        telegramUserId: userId,
        username,
      })
      .onConflictDoUpdate({
        target: [usersTable.telegramUserId],
        set: {
          name,
          username,
        },
      })
      .returning({ userId: usersTable.id });
    await db.insert(leaderboardTable).values({
      score,
      chatId,
      userId: dbUser.userId,
    });

    const formattedResponse = `Congrats! You guessed it correctly.\n${additionalMessage}\nStart with /new\n${formatWordDetails(
      currentGuess,
    )}`;

    ctx.reply(formattedResponse, {
      reply_parameters: { message_id: ctx.message.message_id },
      parse_mode: "HTML",
    });
    ctx.react("🎉");
    await db.delete(gamesTable).where(eq(gamesTable.id, currentGame.id));
    return;
  }

  await db.insert(guessesTable).values({
    gameId: currentGame.id,
    guess: currentGuess,
    chatId: ctx.chat.id.toString(),
  });

  const allGuesses = await db.query.guessesTable.findMany({
    where: eq(guessesTable.gameId, currentGame.id),
    orderBy: asc(guessesTable.createdAt),
  });

  if (allGuesses.length === 30) {
    await db.delete(gamesTable).where(eq(gamesTable.id, currentGame.id));
    return ctx.reply(
      "Game Over! The word was " +
        currentGame.word +
        "\nYou can start a new game with /new",
    );
  }

  ctx.reply(getFeedback(allGuesses, currentGame.word));
});

export const onMessageHander = composer;

interface GuessEntry {
  id: number;
  guess: string;
  gameId: number;
  createdAt: Date;
  updatedAt: Date;
}

function getFeedback(data: GuessEntry[], solution: string) {
  return data
    .map((entry) => {
      let feedback = "";
      const guess = entry.guess.toUpperCase();
      const solutionCount: Record<string, number> = {};

      for (const char of solution.toUpperCase()) {
        solutionCount[char] = (solutionCount[char] || 0) + 1;
      }

      const result = Array(guess.length).fill("🟥");
      for (let i = 0; i < guess.length; i++) {
        if (guess[i] === solution[i].toUpperCase()) {
          result[i] = "🟩";
          solutionCount[guess[i]]--;
        }
      }

      for (let i = 0; i < guess.length; i++) {
        if (result[i] === "🟥" && solutionCount[guess[i]] > 0) {
          result[i] = "🟨";
          solutionCount[guess[i]]--;
        }
      }

      feedback = result.join(" ");
      return `${feedback} ${guess}`;
    })
    .join("\n");
}
