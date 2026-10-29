import { Composer } from "grammy";

import { CommandRegistry } from "#/core/services/command-registry.service";

import { banCommand } from "./admin/ban.command";
import { broadcastCommand } from "./admin/broadcast/broadcast.command";
import { captchaCommand } from "./admin/captcha/captcha.command";
import { statsCommand } from "./admin/stats.command";
import { trackCommand } from "./admin/track.command";
import { transferCommand } from "./admin/transfer.command";
import { unbanCommand } from "./admin/unban.command";
import { idCommand } from "./general/id.command";
import { myScoreCommand } from "./general/my-score.command";
import { startCommand } from "./general/start.command";
import { startMatchCommand } from "./general/startmatch.command";
import { allowOnlyLenCommand } from "./group-settings/allowonlylen.command";
import { recreateTopicCommand } from "./group-settings/recreatetopic.command";
import { seekAuthCommand } from "./group-settings/seekauth.command";
import { setGameTopicCommand } from "./group-settings/setgametopic.command";
import { unsetGameTopicCommand } from "./group-settings/unsetgametopic.command";
import { helpCommand } from "./help/help.command";
import { leaderboardCommand } from "./scores/leaderboard.command";
import { scoreCommand } from "./scores/score.command";
import { dailyWordleCommand } from "./wordle/daily/daily.command";
import { endGameCommand } from "./wordle/regular/end-game.command";
import { newGameCommand } from "./wordle/regular/new-game.command";

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
  captchaCommand,
);

// Keep the exact order the bot has historically advertised in its command menu.
const advertisedCommands: [string, string][] = [
  ["id", "Get detailed information about a message (reply to a message)"],
  ["help", "Get help on how to play and commands list"],
  ["score", "View score for a user (usage: /score [@username or user_id])."],
  ["start", "Start the bot"],
  ["end", "End the current game. Available for only admins in groups."],
  ["new", "Start a new game. Usage: /new [4|5|6]"],
  ["new4", "Start a new 4-letter game."],
  ["new5", "Start a new 5-letter game."],
  ["new6", "Start a new 6-letter game."],
  ["daily", "Play WordSeek of the Day (DM only)"],
  ["pausedaily", "Pause WordSeek of the Day game"],
  ["seekauth", "Manage users authorized to end the seek game (admin only)"],
  ["leaderboard", "View the leaderboard."],
  [
    "allowonlylen",
    "Set allowed word lengths for this topic (e.g. /allowonlylen 5 4)",
  ],
  ["setgametopic", "Set current topic for the game"],
  ["recreatetopic", "Toggle topic recreation on expire (on/off)"],
  ["unsetgametopic", "Unset current topic for the game"],
];

for (const [command, description] of advertisedCommands) {
  CommandRegistry.add(command, description);
}

export const commandRouter = composer;
