import type { CommandContext, Context } from "grammy";

import { db } from "#/config/db";
import { isUniqueViolation } from "#/core/database/errors.helper";
import { runGuards } from "#/core/guards/admin.guard";
import { createLogger } from "#/core/logging/logger.service";
import { replyNotice } from "#/core/telegram/reply-notice.helper";
import type { WordLength } from "#/types";

import { regularGameGuards } from "../../shared/guards/wordle.guard";
import { WordSelector } from "./word-selector.service";

const log = createLogger("features.wordle.regular.services.start-game.service");

const GLOBAL_VALID_LENGTHS: WordLength[] = [5, 4, 6];

function replyAlreadyRunning(ctx: CommandContext<Context>) {
  return ctx.replyWithRichMessage({
    html: `<h5>🎮 Game Already Running</h5>
<blockquote>A game is already in progress in this chat.</blockquote>
<p>Keep guessing the current word, or use /end to start over.</p>`,
  });
}

export async function startGame(
  ctx: CommandContext<Context>,
  forcedLength?: WordLength,
) {
  if (!ctx.from || !ctx.chat) return;

  try {
    const topicId = ctx.msg.message_thread_id?.toString() || "general";
    const chatId = ctx.chat.id;

    const guard = await runGuards(ctx, regularGameGuards);
    if (!guard.ok) return replyNotice(ctx, guard.message);

    const topicSettings = await db
      .selectFrom("chatGameTopics")
      .selectAll()
      .where("chatId", "=", chatId.toString())
      .where("topicId", "=", topicId)
      .executeTakeFirst();

    const allowedLengths: WordLength[] =
      (topicSettings?.allowedLengths as WordLength[]) ?? GLOBAL_VALID_LENGTHS;

    const defaultLength: WordLength = allowedLengths[0]!;

    let wordLength: WordLength;

    if (forcedLength) {
      if (!allowedLengths.includes(forcedLength)) {
        return replyNotice(
          ctx,
          `Only these lengths are allowed in this topic: ${allowedLengths.join(
            ", ",
          )}.`,
        );
      }
      wordLength = forcedLength;
    } else {
      const lengthArg = ctx.match?.trim();

      if (lengthArg) {
        const parsed = Number(lengthArg) as WordLength;

        if (!allowedLengths.includes(parsed)) {
          return replyNotice(
            ctx,
            `Only these lengths are allowed in this topic: ${allowedLengths.join(
              ", ",
            )}.`,
          );
        }

        wordLength = parsed;
      } else {
        wordLength = defaultLength;
      }
    }

    // `games.active_chat` is unique, so a second /new in the same chat cannot
    // insert another row. Check first to avoid triggering (and logging) a
    // duplicate-key error for what is a completely normal user action.
    const activeGame = await db
      .selectFrom("games")
      .select("id")
      .where("source", "=", "telegram")
      .where("activeChat", "=", chatId.toString())
      .executeTakeFirst();

    if (activeGame) return replyAlreadyRunning(ctx);

    const wordSelector = new WordSelector();
    const randomWord = await wordSelector.getRandomWord(chatId, wordLength);

    await db
      .insertInto("games")
      .values({
        word: randomWord,
        activeChat: chatId.toString(),
        topicId,
        startedBy: ctx.from.id.toString(),
      })
      .execute();

    return ctx.replyWithRichMessage({
      html: `<h5>🎮 New Game</h5>
<p>Game started! Guess the <b>${wordLength}-letter</b> word.</p>`,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return replyAlreadyRunning(ctx);
    }

    log.error(error);
    return replyNotice(ctx, "Something went wrong. Please try again.");
  }
}
