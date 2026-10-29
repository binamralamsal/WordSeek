import { Composer } from "grammy";

import { helpCallbacks } from "./help/callbacks";
import { scoresCallbacks } from "./scores/callbacks";
import { captchaCallbacks } from "./admin/captcha/callbacks";
import { voteEndCallback } from "./wordle/regular/vote-callback";
import { wordleHintCallback } from "./wordle/shared/hint-callback";

const composer = new Composer();

// Register the most specific callback families first so that the catch-all
// answer below only responds to genuinely unknown payloads.
composer.use(
  wordleHintCallback,
  scoresCallbacks,
  voteEndCallback,
  helpCallbacks,
  captchaCallbacks,
);

// Always acknowledge unhandled button presses to stop the client spinner.
composer.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());

export { composer as callbacks };
