import { Composer, InlineKeyboard } from "grammy";

import { env } from "../config/env";
import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

type HelpSection = "howto" | "scores" | "group" | "other" | "admin";

function formatHelpButton(label: string, active: boolean) {
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
    .text(formatHelpButton("How to Play", active === "howto"), "help_howto")
    .text(
      formatHelpButton("Leaderboard & Scores", active === "scores"),
      "help_scores",
    )
    .row()
    .text(formatHelpButton("Group Settings", active === "group"), "help_group")
    .text(formatHelpButton("Other Commands", active === "other"), "help_other");

  keyboard
    .row()
    .url("GitHub Repo", "https://github.com/binamralamsal/WordSeek");

  if (shouldShowAdmin) {
    keyboard.text(
      formatHelpButton("👑 Admin Commands", active === "admin"),
      "help_admin",
    );
  }

  return keyboard;
}

export function getHowToPlayMessage() {
  const timezoneLabel = getTimezoneLabel();

  return `<b>▸ How to Play WordSeek</b>

<blockquote>1. Start a game using /new command
2. Guess a random 5-letter word
3. After each guess, you'll get color hints:
   🟩 Correct letter in the right spot
   🟨 Correct letter in the wrong spot
   🟥 Letter not in the word
4. First person to guess correctly wins!
5. Maximum 30 guesses per game</blockquote>

<b>Basic Commands:</b>
• /new - Start a new game
• /end - End current game (voting or admin only)
• /help - Show this help menu
• /daily - Play Daily WordSeek (private chat only)
• /pausedaily - Pause Daily mode and go back to normal games

<b>Daily Mode (Private Chat Only):</b>
<blockquote>• Start a daily game using /daily command
• Works like New York Times Wordle: one fixed word per day
• You only get 6 guesses per daily puzzle
• A new puzzle unlocks every day at 06:00 in <code>${timezoneLabel}</code>
• You build a streak by solving the daily puzzle without failing
• You cannot play normal WordSeek and Daily at the same time:
  - If a normal game is running, end it before using /daily
  - If Daily is active, use /pausedaily to play normal WordSeek again</blockquote>`;
}

export function getScoresMessage() {
  return `<b>▸ Leaderboard & Scores</b>

<b>Quick Examples:</b>
<blockquote><code>/leaderboard</code> - Group, today (default)
<code>/leaderboard global week</code> - Global rankings this week
<code>/leaderboard group month</code> - This group's rankings this month

<code>/score</code> - Your score (group, today by default)
<code>/score @username group all</code> - Full history for a user in this group
<code>/score 123456789 global month</code> - Monthly global stats for a user</blockquote>

<b>Leaderboard Command</b>
<blockquote><b>Syntax:</b> <code>/leaderboard [scope] [period]</code>

<b>Scope:</b>
• <code>group</code> (default) - Current group only
• <code>global</code> - All groups combined

<b>Period:</b>
• <code>today</code> (default) - Today's scores
• <code>week</code> - This week
• <code>month</code> - This month
• <code>year</code> - This year
• <code>all</code> - All time</blockquote>

<b>Score Command</b>
<blockquote><b>Syntax:</b> <code>/score [target] [scope] [period]</code>

<b>Target (optional):</b>
• Leave empty for your own score
• <code>@username</code> - Look up by username
• <code>user_id</code> - Look up by Telegram user ID

<b>Scope & period:</b>
Same as for <code>/leaderboard</code> (group/global and today/week/month/year/all)</blockquote>`;
}

export function getGroupSettingsMessage() {
  return `<b>▸ Group Settings (Admin Only)</b>

<b>Authorized Users</b>
<blockquote><b>/seekauth</b> – Manage users who can end games without a vote.

<b>Usage:</b>
• <code>/seekauth @username</code> – Authorize a user
• <code>/seekauth remove @username</code> – Remove authorization
• <code>/seekauth list</code> – List all authorized users

You can also use a user ID or reply to a message instead of @username.</blockquote>

<b>Game Topic (Forum Groups)</b>
<blockquote><b>/setgametopic</b> – Restrict games to one or more topics
Run this command <i>inside the topic</i> where you want games to be played.
After setting, the bot will only run games in that topic.

<b>/unsetgametopic</b> – Remove topic restriction
Usage: <code>/unsetgametopic</code>
After unsetting, the bot can run games in any topic in the group again. If there are other topics set, the bot will only run in those topics.</blockquote>`;
}

export function getOtherCommandsMessage() {
  return `<b>▸ Other Commands</b>

<blockquote><b>/id</b> - Get message information
Reply to any message to see:
• Message ID and date
• User information
• Chat information
• Forward information (if forwarded)
• File IDs for media</blockquote>`;
}

export function getAdminCommandsMessage() {
  return `<b>▸ Admin Commands (Bot Owner Only)</b>

<blockquote><b>/ban [user_id]</b>
Ban a user from using the bot globally

<b>/unban [user_id]</b>
Unban a previously banned user

<b>/stats</b>
View bot statistics including:
• Total users and groups
• Memory and CPU Usage
• VPS load and bot's performance

<b>/transfer &lt;from_user&gt; &lt;to_user&gt;</b>
Transfer scores between users

<b>/broadcast</b>
Broadcast a message to all broadcastable chats (groups and users)
Reply to a message with this command

<b>/track &lt;chat_id&gt;</b>
Start tracking a chat and send all messages from that chat
Use it only for detecting cheaters

<b>/untrack &lt;chat_id&gt;</b>
Stop tracking a previously tracked chat

<b>/tracklist</b>
Show all currently tracked chats</blockquote>`;
}

composer.command("help", async (ctx) => {
  if (!ctx.from) return;

  const shouldShowAdmin =
    env.ADMIN_USERS.includes(ctx.from.id) && ctx.chat.type === "private";
  const keyboard = getMainHelpKeyboard(shouldShowAdmin, "howto");

  await ctx.reply(getHowToPlayMessage(), {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

CommandsHelper.addNewCommand(
  "help",
  "Get help on how to play and commands list",
);

export const helpCommand = composer;
