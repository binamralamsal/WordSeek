import { Composer, InlineKeyboard } from "grammy";

import { env } from "../config/env";
import { CommandsHelper } from "../util/commands-helper";
import {
  DISCUSSION_GROUP,
  DONATION_LINK,
  UPDATES_CHANNEL,
} from "../config/constants";

const composer = new Composer();

type HelpSection = "howto" | "scores" | "group" | "other" | "admin";
type LetterState = "correct" | "present" | "absent";

export function formatActiveButton(label: string, active: boolean) {
  return active ? `« ${label} »` : label;
}

function getTimezoneLabel(): string {
  const tz = env.TIME_ZONE || "UTC";

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "shortOffset",
    });

    const parts = formatter.formatToParts(now);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value;

    const [, cityRaw] = tz.split("/");
    const city = cityRaw?.replace(/_/g, " ") ?? tz; // e.g. "Kathmandu"

    if (city && tzName) {
      return `${city} time (${tzName})`;
    }
    if (city) {
      return `${city} time`;
    }
    return tz;
  } catch {
    return tz;
  }
}

export function getMainHelpKeyboard(
  shouldShowAdmin: boolean,
  active: HelpSection = "howto",
) {
  const keyboard = new InlineKeyboard()
    .text(formatActiveButton("How to Play", active === "howto"), "help_howto")
    .style(active == "howto" ? "primary" : undefined)
    .text(
      formatActiveButton("Leaderboard & Scores", active === "scores"),
      "help_scores",
    )
    .style(active == "scores" ? "primary" : undefined)
    .row()
    .text(
      formatActiveButton("Group Settings", active === "group"),
      "help_group",
    )
    .style(active == "group" ? "primary" : undefined)
    .text(
      formatActiveButton("Other Commands", active === "other"),
      "help_other",
    )
    .style(active == "other" ? "primary" : undefined);

  if (shouldShowAdmin) {
    keyboard
      .row()
      .text(
        formatActiveButton("👑 Admin Commands", active === "admin"),
        "help_admin",
      )
      .style(active == "admin" ? "primary" : undefined);
  }
  keyboard.url("GitHub Repo", "https://github.com/binamralamsal/WordSeek");
  keyboard.row().url("📢 Updates", UPDATES_CHANNEL);
  keyboard.url("💓 Donate", DONATION_LINK).success();
  keyboard.url("💬 Discussion", DISCUSSION_GROUP);

  return keyboard;
}

const EXAMPLE_STYLE: Record<LetterState, string> = {
  correct: ` style="success"`, // green
  present: "", // default
  absent: ` style="danger"`, // red
};

// Same buttons and callback data as in a real game, so tapping explains them
function exampleButton(state: LetterState, letter: string): string {
  return `<tg-button type="callback_data"${EXAMPLE_STYLE[state]} data="wh:${state}:${letter}">${letter}</tg-button>`;
}

export function getHowToPlayMessage() {
  const timezoneLabel = getTimezoneLabel();

  return `<h3>How to Play WordSeek</h3>
<blockquote>
<ol>
<li>Start a game using /new, /new4, /new5, or /new6</li>
<li>Guess the hidden word</li>
<li>After each guess, every letter becomes a colored button (see below)</li>
<li>First person to guess correctly wins!</li>
<li>Maximum 30 guesses per game</li>
</ol>
</blockquote>

<h4>Reading the colors</h4>
<p>${exampleButton("correct", "S")} <b>Green</b>: right letter, right spot</p>
<p>${exampleButton("present", "T")} <b>No color</b>: right letter, wrong spot</p>
<p>${exampleButton("absent", "X")} <b>Red</b>: letter isn't in the word</p>
<p><i>Tap any letter button to see what it means. The no color button follows your Telegram theme.</i></p>

<p><b>Example guess:</b></p>
<p>${exampleButton("correct", "S")}${exampleButton("present", "T")}${exampleButton("absent", "A")}${exampleButton("absent", "R")}${exampleButton("correct", "E")}</p>

<h4>Word Length Modes</h4>
<blockquote>
<ul>
<li>/new: start the default 5-letter game</li>
<li>/new 4: start a specific length (4, 5, or 6)</li>
<li>/new4: start a 4-letter game</li>
<li>/new5: start a 5-letter game</li>
<li>/new6: start a 6-letter game</li>
</ul>
</blockquote>

<h4>Basic Commands</h4>
<table bordered compact>
<tr><th>Command</th><th>What it does</th></tr>
<tr><td>/new</td><td>Start a new game (default 5 letters)</td></tr>
<tr><td>/new4 /new5 /new6</td><td>Start a game with that length</td></tr>
<tr><td>/end</td><td>End current game (voting or admin only)</td></tr>
<tr><td>/help</td><td>Show this help menu</td></tr>
<tr><td>/daily</td><td>Play Daily WordSeek (private chat only)</td></tr>
<tr><td>/pausedaily</td><td>Pause Daily mode and go back to normal games</td></tr>
</table>

<details><summary>Daily Mode (Private Chat Only)</summary>
<blockquote>
<ul>
<li>Start a daily game using /daily command</li>
<li>Works like New York Times Wordle: one fixed word per day</li>
<li>You only get 6 guesses per daily puzzle</li>
<li>A new puzzle unlocks every day at 06:00 in <code>${timezoneLabel}</code></li>
<li>You build a streak by solving the daily puzzle without failing</li>
<li>You cannot play normal WordSeek and Daily at the same time:
<ul>
<li>If a normal game is running, end it before using /daily</li>
<li>If Daily is active, use /pausedaily to play normal WordSeek again</li>
</ul>
</li>
</ul>
</blockquote>
</details>`;
}

export function getScoresMessage() {
  return `<h3>Leaderboard &amp; Scores</h3>

<h4>Quick Examples</h4>
<blockquote>
<table bordered compact>
<tr><th>Command</th><th>What it shows</th></tr>
<tr><td><code>/leaderboard</code></td><td>Group, today (5-letter)</td></tr>
<tr><td><code>/leaderboard 4</code></td><td>4-letter, group, today</td></tr>
<tr><td><code>/leaderboard global week 6</code></td><td>Global, this week, 6-letter</td></tr>
<tr><td><code>/leaderboard month</code></td><td>This group's monthly board</td></tr>
<tr><td><code>/score</code></td><td>Your score (group, today, 5-letter)</td></tr>
<tr><td><code>/score 6</code></td><td>Your 6-letter stats</td></tr>
<tr><td><code>/score @username global all 4</code></td><td>Full 4-letter global history for a user</td></tr>
<tr><td><code>/score 123456789 month</code></td><td>Monthly stats for a user ID</td></tr>
</table>
</blockquote>

<h4>Leaderboard Command</h4>
<blockquote>
<p><b>Syntax:</b> <code>/leaderboard [scope] [period] [length]</code></p>
<p>All parameters are optional and can be used in any order.</p>
<table bordered compact>
<tr><th>Parameter</th><th>Options</th></tr>
<tr><td>Scope</td><td><code>group</code> (default), <code>global</code></td></tr>
<tr><td>Period</td><td><code>today</code> (default), <code>week</code>, <code>month</code>, <code>year</code>, <code>all</code></td></tr>
<tr><td>Length</td><td><code>4</code>, <code>5</code> (default), <code>6</code></td></tr>
</table>
</blockquote>

<h4>Score Command</h4>
<blockquote>
<p><b>Syntax:</b> <code>/score [target] [scope] [period] [length]</code></p>
<p>All parameters are optional and can be used in any order.</p>
<p><b>Target (optional):</b></p>
<ul>
<li>Leave empty for your own score</li>
<li><code>@username</code>: look up by username</li>
<li><code>user_id</code>: look up by Telegram user ID</li>
</ul>
<p><b>Scope, period &amp; length:</b> same as <code>/leaderboard</code></p>
</blockquote>`;
}

export function getGroupSettingsMessage() {
  return `<h3>Group Settings (Admin Only)</h3>

<h4>Authorized Users</h4>
<blockquote>
<p><b><code>/seekauth</code></b>: manage users who can end games without a vote.</p>
<p><b>Usage:</b></p>
<ul>
<li><code>/seekauth @username</code>: authorize a user</li>
<li><code>/seekauth remove @username</code>: remove authorization</li>
<li><code>/seekauth list</code>: list all authorized users</li>
</ul>
<p>You can also use a user ID or reply to a message instead of @username.</p>
</blockquote>

<h4>Game Topic (Forum Groups)</h4>

<details><summary><code>/setgametopic</code>: restrict games to topics</summary>
<blockquote>
<p>Run this command <i>inside the topic</i> where you want games to be played.</p>
<p>After setting, the bot will only run games in that topic.</p>
</blockquote>
</details>

<details><summary><code>/unsetgametopic</code>: remove topic restriction</summary>
<blockquote>
<p>After unsetting, the bot can run games in any topic in the group again. If there are other topics set, the bot will only run in those topics.</p>
</blockquote>
</details>

<details><summary><code>/allowonlylen</code>: restrict word lengths</summary>
<blockquote>
<p>Run this inside a game topic.</p>
<ul>
<li><code>/allowonlylen 4</code></li>
<li><code>/allowonlylen 5 6</code></li>
</ul>
<p>You can allow one or more of: 4, 5, 6. The first number you specify becomes the default length for <code>/new</code> in that topic.</p>
<p>If not configured, all lengths (4, 5, 6) are allowed by default.</p>
</blockquote>
</details>

<details><summary><code>/recreatetopic</code>: auto-recreate expired topics</summary>
<blockquote>
<ul>
<li><code>/recreatetopic on</code></li>
<li><code>/recreatetopic off</code></li>
</ul>
<p>Run this command inside a game topic.</p>
<p>When enabled, if the topic automatically expires (Telegram forum feature), the bot will recreate the same topic so games can continue.</p>
</blockquote>
</details>`;
}

export function getOtherCommandsMessage() {
  return `<h3>Other Commands</h3>

<blockquote>
<p><b><code>/id</code></b>: get message information</p>
<p>Reply to any message to see:</p>
<ul>
<li>Message ID and date</li>
<li>User information</li>
<li>Chat information</li>
<li>Forward information (if forwarded)</li>
<li>File IDs for media</li>
</ul>
<p><b>Only admins can use it in a group.</b></p>
</blockquote>`;
}

export function getAdminCommandsMessage() {
  return `<h3>Admin Commands (Bot Owner Only)</h3>

<blockquote>
<table bordered compact>
<tr><th>Command</th><th>What it does</th></tr>
<tr><td><code>/ban [user_id]</code></td><td>Ban a user from using the bot globally</td></tr>
<tr><td><code>/unban [user_id]</code></td><td>Unban a previously banned user</td></tr>
<tr><td><code>/transfer &lt;from_user&gt; &lt;to_user&gt;</code></td><td>Transfer scores between users</td></tr>
<tr><td><code>/broadcast</code></td><td>Broadcast to all broadcastable chats (reply to a message)</td></tr>
<tr><td><code>/track &lt;chat_id&gt;</code></td><td>Track a chat and forward its messages (only for detecting cheaters)</td></tr>
<tr><td><code>/untrack &lt;chat_id&gt;</code></td><td>Stop tracking a chat</td></tr>
<tr><td><code>/tracklist</code></td><td>Show all tracked chats</td></tr>
</table>
</blockquote>

<details><summary><code>/stats</code>: bot statistics</summary>
<blockquote>
<ul>
<li>Total users and groups</li>
<li>Memory and CPU usage</li>
<li>VPS load and bot's performance</li>
</ul>
</blockquote>
</details>`;
}

composer.command("help", async (ctx) => {
  if (!ctx.from) return;

  const shouldShowAdmin =
    env.ADMIN_USERS.includes(ctx.from.id) && ctx.chat.type === "private";
  const keyboard = getMainHelpKeyboard(shouldShowAdmin, "howto");

  await ctx.replyWithRichMessage(
    { html: getHowToPlayMessage() },
    { reply_markup: keyboard },
  );
});

CommandsHelper.addNewCommand(
  "help",
  "Get help on how to play and commands list",
);

export const helpCommand = composer;
