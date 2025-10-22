import { Composer } from "grammy";

import { db } from "../config/db";
import { getLeaderboardScores } from "../services/get-leaderboard-scores";
import { CommandsHelper } from "../util/commands-helper";
import { formatLeaderboardMessage } from "../util/format-leaderboard-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { parseLeaderboardFilters } from "../util/parse-leaderboard-input";

const composer = new Composer();

composer.command("leaderboard", async (ctx) => {
  const chatId = ctx.chat.id.toString();

  if (ctx.chat.is_forum) {
    const topicData = await db
      .selectFrom("chatGameTopics")
      .where("chatId", "=", chatId.toString())
      .selectAll()
      .execute();
    const topicIds = topicData.map((t) => t.topicId);
    const currentTopicId = ctx.msg.message_thread_id?.toString() || "general";

    if (topicData.length > 0 && !topicIds.includes(currentTopicId))
      return await ctx.reply(
        "This topic is not set for the game. Please play the game in the designated topic.",
      );
  }

  const { searchKey, timeKey } = parseLeaderboardFilters(
    ctx.match,
    ctx.chat.type === "private" ? "global" : undefined,
  );

  const keyboard = generateLeaderboardKeyboard(searchKey, timeKey);

  const memberScores = await getLeaderboardScores({
    chatId,
    searchKey,
    timeKey,
  });

  ctx.reply(formatLeaderboardMessage(memberScores, searchKey), {
    disable_notification: true,
    reply_markup: keyboard,
    parse_mode: "HTML",
    link_preview_options: {
      is_disabled: true,
    },
  });
});

CommandsHelper.addNewCommand("leaderboard", "View the leaderboard.");

export const leaderboardCommand = composer;
