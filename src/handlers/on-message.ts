import { Composer, Context, GrammyError } from "grammy";

import { and, asc, eq } from "drizzle-orm";

import allWords from "../data/allWords.json";
import commonWords from "../data/commonWords.json";
import { db } from "../drizzle/db";
import {
  bannedUsersTable,
  gamesTable,
  guessesTable,
  leaderboardTable,
  usersTable,
} from "../drizzle/schema";
import { formatWordDetails } from "../util/format-word-details";
import { toFancyText } from "../util/to-fancy-text";

const composer = new Composer();

composer.on("message:text", async (ctx) => {
  const currentGuess = ctx.message.text?.toLowerCase();

  // regex: only 5 English letters (a-z)
  const isValidWord = /^[a-z]{5}$/.test(currentGuess ?? "");

  if (!isValidWord || currentGuess.startsWith("/")) {
    return;
  }

  const [isUserBanned] = await db
    .select()
    .from(bannedUsersTable)
    .where(eq(usersTable.telegramUserId, ctx.from.id.toString()))
    .innerJoin(usersTable, eq(bannedUsersTable.userId, usersTable.id));

  if (isUserBanned) {
    const randomEmoji = (["🤡", "🤣"] as const)[Math.floor(Math.random() * 2)];
    ctx.react(randomEmoji);
    const me = ctx.me.id.toString();

    const botMentioned =
      ctx.message.reply_to_message?.from?.id.toString() === me;

    if (botMentioned) {
      const harshReplies = [
        "Oh, you again? Didn't expect wisdom from you anyway. 🤡",
        "The circus is back in town, and you're the main act! 🎪",
        "Mentioning me won't make you any smarter. Try again. 😂",
        "Still banned, still clueless. What's next? 🤡",
      ];
      const randomReply =
        harshReplies[Math.floor(Math.random() * harshReplies.length)];
      ctx.reply(randomReply, {
        reply_parameters: { message_id: ctx.msgId },
      });
    }
    return;
  }

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
          username: username || null,
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
    reactWithRandom(ctx);
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

  let responseMessage = toFancyText(getFeedback(allGuesses, currentGame.word));

  if (allGuesses.length >= 20) {
    const currentWord = currentGame.word;
    const meaning = commonWords[currentWord]?.meaning;

    if (meaning)
      responseMessage += `\n\n<blockquote><strong>Hint:</strong> ${meaning}</blockquote>`;
  }

  ctx.reply(responseMessage, {
    protect_content: true,
  });
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

async function reactWithRandom(ctx: Context) {
  const emojis: ReactionTypeEmoji["emoji"][] = [
    "🎉",
    "🏆",
    "🤩",
    "⚡",
    "🫡",
    "💯",
    "❤‍🔥",
    "🦄",
  ];

  const shuffled = emojis.sort(() => Math.random() - 0.5);

  for (const emoji of shuffled) {
    try {
      await ctx.react(emoji);
      return;
    } catch (err) {
      if (
        err instanceof GrammyError &&
        err.description?.includes("REACTION_NOT_ALLOWED")
      ) {
        continue;
      } else {
        break;
      }
    }
  }
}
