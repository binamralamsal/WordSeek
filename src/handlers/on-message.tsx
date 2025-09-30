import { Composer, Context, GrammyError, InputFile } from "grammy";
import { ReactionTypeEmoji } from "grammy/types";

import { Canvas, CanvasRenderingContext2D, createCanvas } from "canvas";
import { and, asc, eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";
import satori from "satori";
import sharp from "sharp";

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

  // let responseMessage = toFancyText(getFeedback(allGuesses, currentGame.word));

  // if (allGuesses.length >= 20) {
  //   const currentWord = currentGame.word;
  //   const meaning = commonWords[currentWord]?.meaning;

  //   if (meaning)
  //     responseMessage += `\n\n<blockquote><strong>Hint:</strong> ${meaning}</blockquote>`;
  // }

  // ctx.reply(responseMessage, {
  //   protect_content: true,
  // });

  let responseMessage = toFancyText(getFeedback(allGuesses, currentGame.word));

  if (allGuesses.length >= 20) {
    const currentWord = currentGame.word;
    const meaning = commonWords[currentWord]?.meaning;

    if (meaning)
      responseMessage += `\n\n<blockquote><strong>Hint:</strong> ${meaning}</blockquote>`;
  }

  // Generate and send image
  const imageBuffer = await generateWordleImage(allGuesses, currentGame.word);

  ctx.replyWithPhoto(new InputFile(imageBuffer), {
    // caption: responseMessage,
    protect_content: true,
    parse_mode: "HTML",
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

// function generateWordleImage(data: GuessEntry[], solution: string): Buffer {
//   const tileSize = 60;
//   const gap = 8;
//   const padding = 20;
//   const wordLength = solution.length;

//   const width = padding * 2 + wordLength * tileSize + (wordLength - 1) * gap;
//   const height = padding * 2 + data.length * tileSize + (data.length - 1) * gap;

//   const canvas = createCanvas(width, height);
//   const ctx = canvas.getContext("2d");

//   // Background
//   ctx.fillStyle = "#121213";
//   ctx.fillRect(0, 0, width, height);

//   data.forEach((entry, rowIndex) => {
//     const guess = entry.guess.toUpperCase();
//     const solutionCount: Record<string, number> = {};

//     for (const char of solution.toUpperCase()) {
//       solutionCount[char] = (solutionCount[char] || 0) + 1;
//     }

//     const result = Array(guess.length).fill("absent");

//     // First pass: mark correct positions
//     for (let i = 0; i < guess.length; i++) {
//       if (guess[i] === solution[i].toUpperCase()) {
//         result[i] = "correct";
//         solutionCount[guess[i]]--;
//       }
//     }

//     // Second pass: mark present letters
//     for (let i = 0; i < guess.length; i++) {
//       if (result[i] === "absent" && solutionCount[guess[i]] > 0) {
//         result[i] = "present";
//         solutionCount[guess[i]]--;
//       }
//     }

//     // Draw tiles
//     for (let col = 0; col < guess.length; col++) {
//       const x = padding + col * (tileSize + gap);
//       const y = padding + rowIndex * (tileSize + gap);

//       // Set color based on result
//       if (result[col] === "correct") {
//         ctx.fillStyle = "#538d4e";
//       } else if (result[col] === "present") {
//         ctx.fillStyle = "#b59f3b";
//       } else {
//         ctx.fillStyle = "#3a3a3c";
//       }

//       ctx.fillRect(x, y, tileSize, tileSize);

//       // Draw letter
//       ctx.fillStyle = "#ffffff";
//       ctx.font = "bold 32px Arial";
//       ctx.textAlign = "center";
//       ctx.textBaseline = "middle";
//       ctx.fillText(guess[col], x + tileSize / 2, y + tileSize / 2);
//     }
//   });

//   return canvas.toBuffer("image/png");
// }

async function generateWordleImage(
  data: GuessEntry[],
  solution: string,
): Promise<Buffer> {
  const tiles = data.map((entry) => {
    const guess = entry.guess.toUpperCase();
    const solutionCount: Record<string, number> = {};

    for (const char of solution.toUpperCase()) {
      solutionCount[char] = (solutionCount[char] || 0) + 1;
    }

    const result = Array(guess.length).fill("absent");

    // First pass: mark correct positions
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === solution[i].toUpperCase()) {
        result[i] = "correct";
        solutionCount[guess[i]]--;
      }
    }

    // Second pass: mark present letters
    for (let i = 0; i < guess.length; i++) {
      if (result[i] === "absent" && solutionCount[guess[i]] > 0) {
        result[i] = "present";
        solutionCount[guess[i]]--;
      }
    }

    return { guess, result };
  });

  const getColor = (state: string) => {
    if (state === "correct") return "#538d4e";
    if (state === "present") return "#b59f3b";
    return "#3a3a3c";
  };

  const fontPath = join(process.cwd(), "src", "fonts", "roboto.ttf");
  // or wherever your font is located
  const fontData = await readFile(fontPath);

  const svg = await satori(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#121213",
        padding: "20px",
        gap: "8px",
      }}
    >
      {tiles.map(({ guess, result }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          {guess.split("").map((letter, i) => (
            <div
              style={{
                width: "60px",
                height: "60px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: getColor(result[i]),
                color: "white",
                fontSize: "32px",
                fontWeight: "bold",
                fontFamily: "Arial",
              }}
            >
              {letter}
            </div>
          ))}
        </div>
      ))}
    </div>,
    {
      width: 20 + solution.length * 60 + (solution.length - 1) * 8 + 20,
      height: 20 + data.length * 60 + (data.length - 1) * 8 + 20,
      fonts: [
        {
          name: "Roboto Flex",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );

  // Convert SVG to PNG
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return pngBuffer;
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
