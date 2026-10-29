import { Composer } from "grammy";

import { getHint } from "./helpers/board.helper";

const composer = new Composer();

composer.callbackQuery(/^wh:/, async (ctx) => {
  const [, state, letter] = ctx.callbackQuery.data.split(":");

  if (!state || !letter) {
    return ctx.answerCallbackQuery();
  }

  return ctx.answerCallbackQuery({
    text: getHint(state, letter),
  });
});

export const wordleHintCallback = composer;
