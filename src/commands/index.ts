import { Composer } from "grammy";

import { banCommand } from "./ban-user";
import { endGameCommand } from "./end-game";
import { helpCommand } from "./help";
import { leaderboardCommand } from "./leaderboard";
import { myScoreCommand } from "./my-score";
import { newGameCommand } from "./new-game";
import { scoreCommand } from "./score";
import { seekAuthCommand } from "./seekauth";
import { setGameTopicCommand } from "./setgametopic";
import { startCommand } from "./start";
import { startMatchCommand } from "./startmatch";
import { statsCommand } from "./stats";
import { trackCommand } from "./track";
import { unbanCommand } from "./unban-user";
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
);

export const commands = composer;
