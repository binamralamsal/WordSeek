import { Composer } from "grammy";

import { idCommand } from "./id";
import { helpCommand } from "./help";
import { scoreCommand } from "./score";
import { startCommand } from "./start";
import { statsCommand } from "./stats";
import { trackCommand } from "./track";
import { banCommand } from "./ban-user";
import { endGameCommand } from "./end-game";
import { myScoreCommand } from "./my-score";
import { newGameCommand } from "./new-game";
import { unbanCommand } from "./unban-user";
import { dailyWordleCommand } from "./daily";
import { seekAuthCommand } from "./seekauth";
import { transferCommand } from "./transfer";
import { broadcastCommand } from "./broadcast";
import { startMatchCommand } from "./startmatch";
import { leaderboardCommand } from "./leaderboard";
import { allowOnlyLenCommand } from "./allowonlylen";
import { setGameTopicCommand } from "./setgametopic";
import { recreateTopicCommand } from "./recreatetopic";
import { unsetGameTopicCommand } from "./unsetgametopic";

const composer = new Composer();

composer.use(
  startCommand,
  helpCommand,
  newGameCommand,
  endGameCommand,
  myScoreCommand,
  statsCommand,
  banCommand,
  unbanCommand,
  leaderboardCommand,
  scoreCommand,
  seekAuthCommand,
  startMatchCommand,
  setGameTopicCommand,
  unsetGameTopicCommand,
  trackCommand,
  transferCommand,
  broadcastCommand,
  dailyWordleCommand,
  idCommand,
  allowOnlyLenCommand,
  recreateTopicCommand,
);

export const commands = composer;
