import { Composer, Context, GrammyError } from "grammy";
import { InputFile } from "grammy";
import { ReactionTypeEmoji } from "grammy/types";

import { readFile } from "fs/promises";
import { join } from "path";
import satori from "satori";
import sharp from "sharp";
import z from "zod";

import { db } from "../config/db";
import { redis } from "../config/redis";
import allWords from "../data/allWords.json";
import commonWords from "../data/commonWords.json";
import { getCurrentGameDateString } from "../services/daily-wordle-cron";
import {
  formatDailyWordDetails,
  formatWordDetails,
} from "../util/format-word-details";
import { toFancyText } from "../util/to-fancy-text";

const composer = new Composer();

export const dailyWordleSchema = z.object({
  dailyWordId: z.number(),
  date: z.string(),
});

composer.on("message:text", async (ctx) => {
  const currentGuess = ctx.message.text?.toLowerCase();

  const isValidWord = /^[a-z]{5}$/.test(currentGuess ?? "");

  if (!isValidWord || currentGuess.startsWith("/")) {
    return;
  }

  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id.toString();

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

  if (ctx.chat.type === "private") {
    const dailyGameData = await redis.get(`daily_wordle:${userId}`);
    const result = dailyWordleSchema.safeParse(
      JSON.parse(dailyGameData || "{}"),
    );
    if (result.success) {
      const todayDate = getCurrentGameDateString();

      if (result.data.date !== todayDate) {
        await redis.del(`daily_wordle:${userId}`);
        return ctx.reply(
          "Your previous game has expired. Please start today's WordSeek with /daily",
        );
      }

      return handleDailyWordleGuess(ctx, currentGuess);
    }
  }

  const currentGame = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", ctx.chat.id.toString())
    .executeTakeFirst();

  if (!currentGame) return;

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
    parse_mode: "HTML",
  });
});

async function handleDailyWordleGuess(ctx: Context, currentGuess: string) {
  const userId = ctx.from!.id.toString();

  if (
    !allWords.includes(currentGuess) &&
    !Object.keys(commonWords).includes(currentGuess)
  ) {
    return ctx.reply(`${currentGuess.toUpperCase()} is not a valid word.`);
  }

  const todayDate = getCurrentGameDateString();

  const dailyWord = await db
    .selectFrom("dailyWords")
    .selectAll()
    .where("date", "=", new Date(todayDate))
    .executeTakeFirst();

  if (!dailyWord) {
    return ctx.reply(
      "Today's WordSeek is not available. Please try again later.",
    );
  }

  const existingGuesses = await db
    .selectFrom("dailyGuesses")
    .selectAll()
    .where("userId", "=", userId)
    .where("dailyWordId", "=", dailyWord.id)
    .orderBy("attemptNumber", "asc")
    .execute();

  if (existingGuesses.some((g) => g.guess === currentGuess)) {
    return ctx.reply("You've already guessed this word. Try a different one!");
  }

  const attemptNumber = existingGuesses.length + 1;
  await db
    .insertInto("dailyGuesses")
    .values({
      userId,
      dailyWordId: dailyWord.id,
      guess: currentGuess,
      attemptNumber,
    })
    .execute();

  const allGuesses = await db
    .selectFrom("dailyGuesses")
    .selectAll()
    .where("userId", "=", userId)
    .where("dailyWordId", "=", dailyWord.id)
    .orderBy("attemptNumber", "asc")
    .execute();

  if (currentGuess === dailyWord.word) {
    await handleDailyWordleWin(ctx, dailyWord, allGuesses);
    return;
  }

  if (allGuesses.length >= 6) {
    await handleDailyWordleLoss(ctx, dailyWord, allGuesses);
    return;
  }

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const attemptsLeft = 6 - allGuesses.length;

  await ctx.replyWithPhoto(new InputFile(new Uint8Array(imageBuffer)), {
    caption: `${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} remaining`,
  });
}

type DailyWord = {
  date: Date;
  dayNumber: number;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
  word: string;
};
async function handleDailyWordleWin(
  ctx: Context,
  dailyWord: DailyWord,
  allGuesses: GuessEntry[],
) {
  const userId = ctx.from!.id.toString();

  await redis.del(`daily_wordle:${userId}`);

  const userStats = await db
    .selectFrom("userStats")
    .selectAll()
    .where("userId", "=", userId)
    .executeTakeFirst();

  if (userStats) {
    const todayDateString = getCurrentGameDateString();
    const todayDate = new Date(todayDateString + "T00:00:00");

    let newStreak = 1;

    if (userStats.lastGuessed) {
      const lastGuessedDate = new Date(userStats.lastGuessed);
      lastGuessedDate.setHours(0, 0, 0, 0);

      const diffTime = todayDate.getTime() - lastGuessedDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak = userStats.currentStreak + 1;
      } else if (diffDays === 0) {
        newStreak = userStats.currentStreak;
      }
    }

    const newHighestStreak = Math.max(newStreak, userStats.highestStreak);

    await db
      .updateTable("userStats")
      .set({
        currentStreak: newStreak,
        highestStreak: newHighestStreak,
        lastGuessed: new Date().toISOString(),
      })
      .where("userId", "=", userId)
      .execute();

    const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
    const shareText = generateWordleShareText(
      dailyWord.dayNumber,
      allGuesses,
      dailyWord.word,
    );

    await ctx.replyWithPhoto(new InputFile(new Uint8Array(imageBuffer)), {
      caption: `🎉 Congratulations! You guessed it in ${allGuesses.length} ${allGuesses.length === 1 ? "try" : "tries"}!\n\n🔥 Current Streak: ${newStreak}\n⭐ Highest Streak: ${newHighestStreak}\n\n${formatDailyWordDetails(dailyWord)}`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📤 Share",
              switch_inline_query: shareText,
            },
          ],
        ],
      },
    });

    reactWithRandom(ctx);
  }
}

export function generateWordleShareText(
  dayNumber: number,
  guesses: GuessEntry[],
  solution: string,
) {
  const totalAttempts = guesses.length;
  const attemptLine = `${dayNumber} ${totalAttempts}/6`;

  const lines = guesses.map((entry) => {
    const guess = entry.guess.toUpperCase();
    const sol = solution.toUpperCase();
    const result: string[] = [];

    const solutionCount: Record<string, number> = {};

    for (const c of sol) {
      solutionCount[c] = (solutionCount[c] || 0) + 1;
    }

    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === sol[i]) {
        result[i] = "🟩";
        solutionCount[guess[i]]--;
      }
    }

    for (let i = 0; i < guess.length; i++) {
      if (result[i]) continue;
      if (solutionCount[guess[i]] > 0) {
        result[i] = "🟨";
        solutionCount[guess[i]]--;
      } else {
        result[i] = "⬛";
      }
    }

    return result.join("");
  });

  return `WordSeek ${attemptLine}\n\n${lines.join("\n")}\nTry yourself by using /daily command.`;
}

async function handleDailyWordleLoss(
  ctx: Context,
  dailyWord: DailyWord,
  allGuesses: GuessEntry[],
) {
  const userId = ctx.from!.id.toString();

  await redis.del(`daily_wordle:${userId}`);

  await db
    .updateTable("userStats")
    .set({
      currentStreak: 0,
      lastGuessed: new Date().toISOString(),
    })
    .where("userId", "=", userId)
    .execute();

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const shareText = generateWordleShareText(
    dailyWord.dayNumber,
    allGuesses,
    dailyWord.word,
  );

  await ctx.replyWithPhoto(new InputFile(new Uint8Array(imageBuffer)), {
    caption: `Game Over! The word was: ${dailyWord.word.toUpperCase()}\n\n💔 Streak reset to 0\n\n${formatDailyWordDetails(dailyWord)}\n\nCome back tomorrow for a new challenge!`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📤 Share",
            switch_inline_query: shareText,
          },
        ],
      ],
    },
  });
}

export const onMessageHander = composer;

interface GuessEntry {
  id: number;
  guess: string;
  gameId?: number;
  dailyWordId?: number;
  attemptNumber?: number;
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

export async function generateWordleImage(
  data: GuessEntry[],
  solution: string,
) {
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

  const fontPath = join(process.cwd(), "src", "fonts", "roboto.ttf");
  const fontData = await readFile(fontPath);

  const tileSize = 60;
  const gap = 8;
  const padding = 20;

  const columnWidth = solution.length * tileSize + (solution.length - 1) * gap;
  const width = padding * 2 + columnWidth;
  const height = padding * 2 + 6 * tileSize + 5 * gap; // Always 6 rows for daily wordle

  // Pad with empty rows if less than 6 guesses
  const paddedTiles = [...tiles];
  while (paddedTiles.length < 6) {
    paddedTiles.push({
      guess: "     ",
      result: Array(5).fill("empty"),
    });
  }

  const svg = await satori(
    <div
      style={{
        display: "flex",
        background: "#121213",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {paddedTiles.map(({ guess, result }, rowIdx) => (
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
                  background:
                    result[i] === "empty" ? "#3a3a3c" : getColor(result[i]),
                  color: result[i] === "empty" ? "#3a3a3c" : "white",
                  fontSize: "32px",
                  fontWeight: "bold",
                  border: result[i] === "empty" ? "2px solid #565758" : "none",
                }}
              >
                {letter.trim()}
              </div>
            ))}
          </div>
        ))}
      </div>
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
