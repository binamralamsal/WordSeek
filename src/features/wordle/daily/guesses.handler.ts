import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";

import { formatDailyWordDetails } from "#/core/format/word-details.helper";
import { replyNotice } from "#/core/telegram/reply-notice.helper";
import { renderInlineKeyboard } from "#/core/telegram/rich-keyboard.helper";
import type { MiniAppDailyState } from "#/shared/miniapp";
import { evaluateGuess } from "#/shared/wordle";

import { sendBoardMessage } from "../shared/helpers/board-message.helper";
import { generateWordleImage } from "../shared/helpers/image.helper";
import { reactWithRandom } from "../shared/helpers/reactions.helper";
import {
  type DailyWordRow,
  submitDailyGuess,
} from "./services/daily-play.service";

const DAILY_ATTEMPTS = 6;

function shareKeyboard(shareText: string) {
  return renderInlineKeyboard(
    new InlineKeyboard().switchInline("📤 Share", shareText),
  );
}

export async function handleDailyWordleGuess(
  ctx: Context,
  currentGuess: string,
) {
  const userId = ctx.from!.id.toString();
  const result = await submitDailyGuess(userId, currentGuess);

  if (!result.ok) {
    if (result.code === "INVALID_WORD") {
      return replyNotice(
        ctx,
        `${currentGuess.toUpperCase()} is not a valid word.`,
      );
    }

    return replyNotice(ctx, result.message);
  }

  const { state, dailyWord } = result;

  if (state.status === "won") {
    await handleDailyWordleWin(ctx, dailyWord, state);
    return;
  }

  if (state.status === "lost") {
    await handleDailyWordleLoss(ctx, dailyWord, state);
    return;
  }

  const imageBuffer = await generateWordleImage(state.guesses, dailyWord.word);
  const attemptsLeft = DAILY_ATTEMPTS - state.guesses.length;
  const attemptsLabel = attemptsLeft === 1 ? "attempt" : "attempts";

  await sendBoardMessage(
    ctx,
    imageBuffer,
    `<p><b>${attemptsLeft}</b> ${attemptsLabel} remaining</p>`,
    { caption: `${attemptsLeft} ${attemptsLabel} remaining` },
  );
}

async function handleDailyWordleWin(
  ctx: Context,
  dailyWord: DailyWordRow,
  state: MiniAppDailyState,
) {
  const imageBuffer = await generateWordleImage(state.guesses, dailyWord.word);
  const shareText = generateWordleShareText(
    dailyWord.dayNumber,
    state.guesses,
    dailyWord.word,
  );
  const triesLabel = state.guesses.length === 1 ? "try" : "tries";
  const details = formatDailyWordDetails(dailyWord);
  const captionDetails = formatDailyWordDetails(dailyWord, "\n");

  await sendBoardMessage(
    ctx,
    imageBuffer,
    `<h5>🎉 You Guessed It!</h5>
<p>Solved today's WordSeek in <b>${state.guesses.length}</b> ${triesLabel}.</p>
<blockquote>🔥 Current streak <b>${state.streak.current}</b><br>⭐ Highest streak <b>${state.streak.highest}</b></blockquote>
${details}
${shareKeyboard(shareText)}`,
    {
      caption: `🎉 Congratulations! You guessed it in ${state.guesses.length} ${triesLabel}!\n\n🔥 Current Streak: ${state.streak.current}\n⭐ Highest Streak: ${state.streak.highest}\n\n${captionDetails}`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📤 Share",
              switch_inline_query: shareText,
            },
          ],
        ],
      },
    },
  );

  reactWithRandom(ctx);
}

async function handleDailyWordleLoss(
  ctx: Context,
  dailyWord: DailyWordRow,
  state: MiniAppDailyState,
) {
  const imageBuffer = await generateWordleImage(state.guesses, dailyWord.word);
  const shareText = generateWordleShareText(
    dailyWord.dayNumber,
    state.guesses,
    dailyWord.word,
  );
  const details = formatDailyWordDetails(dailyWord);
  const captionDetails = formatDailyWordDetails(dailyWord, "\n");

  await sendBoardMessage(
    ctx,
    imageBuffer,
    `<h5>💔 Game Over</h5>
<p>The word was <b>${dailyWord.word.toUpperCase()}</b>.</p>
<blockquote>Streak reset to <b>0</b></blockquote>
${details}
<footer>Come back tomorrow for a new challenge!</footer>
${shareKeyboard(shareText)}`,
    {
      caption: `Game Over! The word was: ${dailyWord.word.toUpperCase()}\n\n💔 Streak reset to 0\n\n${captionDetails}\n\nCome back tomorrow for a new challenge!`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: "📤 Share",
              switch_inline_query: shareText,
            },
          ],
        ],
      },
    },
  );
}

const SHARE_EMOJI = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
} as const;

export function generateWordleShareText(
  dayNumber: number,
  guesses: { guess: string }[],
  solution: string,
) {
  const totalAttempts = guesses.length;
  const attemptLine = `${dayNumber} ${totalAttempts}/${DAILY_ATTEMPTS}`;

  const lines = guesses.map((entry) =>
    evaluateGuess(entry.guess, solution)
      .map((state) => SHARE_EMOJI[state])
      .join(""),
  );

  return `WordSeek ${attemptLine}\n\n${lines.join("\n")}\nTry yourself by using /daily command.`;
}
