import { Composer, Context, GrammyError } from "grammy";
import { ReactionTypeEmoji } from "grammy/types";

import { readFile } from "fs/promises";
import { join } from "path";
import satori from "satori";
import sharp from "sharp";

import { db } from "../config/db";
import allWords from "../data/allWords.json";
import commonWords from "../data/commonWords.json";
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

  const isUserBanned = await db
    .selectFrom("bannedUsers")
    .selectAll()
    .where("userId", "=", ctx.from.id.toString())
    .executeTakeFirst();

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

  const currentGame = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", ctx.chat.id.toString())
    .executeTakeFirst();

  if (!currentGame) return;

  const chatId = ctx.chat.id.toString();

  if (ctx.chat.is_forum) {
    const topicData = await db
      .selectFrom("chatGameTopics")
      .where("chatId", "=", chatId.toString())
      .selectAll()
      .execute();
    const topicIds = topicData.map((t) => t.topicId);
    const currentTopicId = ctx.msg.message_thread_id?.toString() || "general";

    if (topicData.length > 0 && !topicIds.includes(currentTopicId)) return;
  }

  if (
    !allWords.includes(currentGuess) &&
    !Object.keys(commonWords).includes(currentGuess)
  )
    return ctx.reply(`${currentGuess} is not a valid word.`);

  const guessExists = await db
    .selectFrom("guesses")
    .selectAll()
    .where("guess", "=", currentGuess)
    .where("chatId", "=", ctx.chat.id.toString())
    .executeTakeFirst();

  if (guessExists)
    return ctx.reply(
      "Someone has already guessed your word. Please try another one!",
    );

  const userId = ctx.from.id.toString();

  if (currentGuess === currentGame.word) {
    if (!ctx.from.is_bot) {
      const allGuesses = await db
        .selectFrom("guesses")
        .selectAll()
        .where("gameId", "=", currentGame.id)
        .execute();

      const score = 30 - allGuesses.length;
      const additionalMessage = `Added ${
        30 - allGuesses.length
      } to the leaderboard.`;

      await db
        .insertInto("leaderboard")
        .values({
          score,
          chatId,
          userId,
        })
        .execute();

      const formattedResponse = `Congrats! You guessed it correctly.\n${additionalMessage}\nStart with /new\n${formatWordDetails(
        currentGuess,
      )}`;

      ctx.reply(formattedResponse, {
        reply_parameters: { message_id: ctx.message.message_id },
        parse_mode: "HTML",
      });
    } else {
      const additionalMessage = `Anonymous admins or channels don't get points.`;

      const formattedResponse = `Congrats! You guessed it correctly.\n${additionalMessage}\nStart with /new\n${formatWordDetails(
        currentGuess,
      )}`;

      ctx.reply(formattedResponse, {
        reply_parameters: { message_id: ctx.message.message_id },
        parse_mode: "HTML",
      });
    }

    reactWithRandom(ctx);
    await db.deleteFrom("games").where("id", "=", currentGame.id).execute();
    return;
  }

  await db
    .insertInto("guesses")
    .values({
      gameId: currentGame.id,
      guess: currentGuess,
      chatId,
    })
    .execute();

  const allGuesses = await db
    .selectFrom("guesses")
    .selectAll()
    .where("gameId", "=", currentGame.id)
    .orderBy("createdAt", "asc")
    .execute();

  if (allGuesses.length === 30) {
    await db.deleteFrom("games").where("id", "=", currentGame.id).execute();
    return ctx.reply(
      "Game Over! The word was " +
        currentGame.word +
        "\nYou can start a new game with /new",
    );
  }

  let responseMessage = toFancyText(getFeedback(allGuesses, currentGame.word));

  if (allGuesses.length >= 20) {
    const currentWord = currentGame.word;
    const meaning =
      commonWords[currentWord as keyof typeof commonWords]?.meaning;

    if (meaning)
      responseMessage += `\n\n<blockquote><strong>Hint:</strong> ${meaning}</blockquote>`;
  }

  ctx.reply(responseMessage, {
    protect_content: true,
  });

  // const imageBuffer = await generateWordleImage(allGuesses, currentGame.word);

  // ctx.replyWithPhoto(new InputFile(new Uint8Array(imageBuffer)), {
  //   protect_content: true,
  //   parse_mode: "HTML",
  // });
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

async function generateWordleImage(data: GuessEntry[], solution: string) {
  const tiles = data.map((entry) => {
    const guess = entry.guess.toUpperCase();
    const solutionCount: Record<string, number> = {};

    for (const char of solution.toUpperCase()) {
      solutionCount[char] = (solutionCount[char] || 0) + 1;
    }

    const result = Array(guess.length).fill("absent");

    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === solution[i].toUpperCase()) {
        result[i] = "correct";
        solutionCount[guess[i]]--;
      }
    }

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

  // Determine number of columns
  const numColumns = data.length > 15 ? 2 : 1;
  const tilesPerColumn = Math.ceil(tiles.length / numColumns);

  // Split tiles into columns
  const columns: (typeof tiles)[] = [];
  for (let i = 0; i < numColumns; i++) {
    columns.push(tiles.slice(i * tilesPerColumn, (i + 1) * tilesPerColumn));
  }

  const fontPath = join(process.cwd(), "src", "fonts", "roboto.ttf");
  const fontData = await readFile(fontPath);

  const tileSize = 60;
  const gap = 8;
  const padding = 20;
  const columnGap = 16;

  const columnWidth = solution.length * tileSize + (solution.length - 1) * gap;
  const width =
    padding * 2 + numColumns * columnWidth + (numColumns - 1) * columnGap;
  const height =
    padding * 2 + tilesPerColumn * tileSize + (tilesPerColumn - 1) * gap;

  const svg = await satori(
    <div
      style={{
        display: "flex",
        background: "#121213",
        padding: "20px",
        gap: `${columnGap}px`,
      }}
    >
      {columns.map((column, colIdx) => (
        <div
          key={colIdx}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {column.map(({ guess, result }, rowIdx) => (
            <div key={rowIdx} style={{ display: "flex", gap: "8px" }}>
              {guess.split("").map((letter, i) => (
                <div
                  key={i}
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
                  }}
                >
                  {letter}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>,
    {
      width,
      height,
      fonts: [
        {
          name: "Roboto",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );

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
