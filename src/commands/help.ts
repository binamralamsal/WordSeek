import { Composer } from "grammy";

import { FOOTER_MESSAGE } from "../config/constants";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("help", (ctx) =>
  ctx.reply(
    `<blockquote>How to Play:</blockquote>
  1. You have to guess a random 5-letter word.
  2. After each guess, you'll get hints:
     - 🟩 - Correct letter in the right spot.
     - 🟨 - Correct letter in the wrong spot.
     - 🟥 - Letter not in the word.
  3. The game will run until the word is found or a maximum of 30 guesses are reached.
  4. The first person to guess the word correctly wins.

  Commands:
  - /new - Start a new game.
  - /end - End the current game. Available for only admins in groups.
  - /help - Get help on how to play and commands list.
  - /leaderboard - Get leaderboard from current group.
  - /score - Get your score of the game.
  - /score [@username/user_id] - Get score of anyone in the game.
  - Leaderboard, and Score parameters: /[leaderboard/score] [global/group] [today/week/month/year/all]
  - Example: <code>/leaderboard global month</code> <code>/score group all</code>

  ${FOOTER_MESSAGE}`,
    { parse_mode: "HTML" },
  ),
);

CommandsHelper.addNewCommand(
  "help",
  "Get help on how to play and commands list.",
);

export const helpCommand = composer;
