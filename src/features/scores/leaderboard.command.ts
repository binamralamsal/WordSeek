import { Composer } from "grammy";

import { env } from "#/config/env";
import { runGuards } from "#/core/guards/admin.guard";
import { replyNotice } from "#/core/telegram/reply-notice.helper";
import { renderInlineKeyboard } from "#/core/telegram/rich-keyboard.helper";
import { requireAllowedTopic } from "#/features/wordle/shared/guards/wordle.guard";

import { formatLeaderboardMessage } from "./helpers/format-leaderboard-message.helper";
import { generateLeaderboardKeyboard } from "./helpers/leaderboard-keyboard.helper";
import { parseLeaderboardFilters } from "./helpers/parse-filters.helper";
import { getLeaderboardView } from "./services/get-leaderboard-view.service";

const composer = new Composer();

composer.command("leaderboard", async (ctx) => {
  const chatId = ctx.chat.id.toString();

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return replyNotice(ctx, guard.message);

  const { searchKey, timeKey, wordLength } = parseLeaderboardFilters(
    ctx.match,
    ctx.chat.type === "private" ? "global" : undefined,
  );

  const keyboard = generateLeaderboardKeyboard(searchKey, timeKey, wordLength);

  const leaderboard = await getLeaderboardView({
    chatId,
    requesterId: ctx.from?.id.toString(),
    searchKey,
    timeKey,
    wordLength,
  });

  const message = formatLeaderboardMessage(
    leaderboard.entries,
    searchKey,
    timeKey,
    wordLength,
    {
      // Admins are identifiable in every leaderboard, including groups.
      revealIds: new Set(env.ADMIN_USERS.map(String)),
      currentUser: leaderboard.currentUser,
    },
  );

  return ctx.replyWithRichMessage(
    { html: `${message}\n${renderInlineKeyboard(keyboard)}` },
    { disable_notification: true },
  );
});

export const leaderboardCommand = composer;
