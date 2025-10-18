import { Composer } from "grammy";

const composer = new Composer();

composer.command("myscore", async (ctx) => {
  return ctx.reply(
    "Please switch to /score command. It's a replacement for /myscore command",
    { reply_to_message_id: ctx.msgId },
  );
});

export const myScoreCommand = composer;
