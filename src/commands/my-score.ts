import { Composer } from "grammy";

import { getUserScores } from "../services/get-user-scores";
import { CommandsHelper } from "../util/commands-helper";
import { formatUserScoreMessage } from "../util/format-user-score-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { parseLeaderboardInput } from "../util/parse-leaderboard-input";

const composer = new Composer();

composer.command("myscore", async (ctx) => {
  return ctx.reply(
    "Please switch to /score command. It's a replacement for /myscore command",
    { reply_to_message_id: ctx.msgId },
  );
});

export const myScoreCommand = composer;
