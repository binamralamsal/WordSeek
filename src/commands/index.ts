import { Composer } from "grammy";

import { banCommand } from "./ban-user";
import { endGameCommand } from "./end-game";
import { helpCommand } from "./help";
import { leaderboardCommand } from "./leaderboard";
import { myScoreCommand } from "./my-score";
import { newGameCommand } from "./new-game";
import { scoreCommand } from "./score";
import { startCommand } from "./start";
import { statsCommand } from "./stats";
import { unbanCommand } from "./unban-user";

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
);

export const commands = composer;
