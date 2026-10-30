import { Composer } from "grammy";

import { captchaCallbacks } from "./admin/captcha/captcha.callback";
import { helpCallbacks } from "./help/help.callback";
import { leaderboardCallbacks } from "./scores/leaderboard.callback";
import { scoreCallbacks } from "./scores/score.callback";
import { voteEndCallback } from "./wordle/regular/vote.callback";
import { wordleHintCallback } from "./wordle/shared/hint.callback";

const composer = new Composer();

// Register the most specific callback families first so that the catch-all
// answer below only responds to genuinely unknown payloads.
composer.use(
  wordleHintCallback,
  leaderboardCallbacks,
  scoreCallbacks,
  voteEndCallback,
  helpCallbacks,
  captchaCallbacks,
);

// Always acknowledge unhandled button presses to stop the client spinner.
composer.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

export const callbackRouter = composer;
