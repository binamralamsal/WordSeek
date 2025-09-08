import { Composer } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../drizzle/db";
import { gamesTable } from "../drizzle/schema";
import { CommandsHelper } from "../util/commands-helper";
import { formatWordDetails } from "../util/format-word-details";

const composer = new Composer();

composer.command("end", async (ctx) => {
  try {
    if (!ctx.message) return;

    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
      try {
        // check if *bot itself* is admin first
        const botMember = await ctx.api.getChatMember(ctx.chat.id, ctx.me.id);

        if (botMember.status !== "administrator" && botMember.status !== "creator") {
          return ctx.reply(
            "⚠️ I need to be an admin to check who can end games.\n" +
            "👉 Please promote me to admin so I can work properly."
          );
        }

        // if bot is admin, then check if user is admin
        const chatMember = await ctx.api.getChatMember(
          ctx.chat.id,
          ctx.message.from.id,
        );

        const allowedStatus = ["administrator", "creator"];
        if (!allowedStatus.includes(chatMember.status)) {
          return ctx.reply("Only admins can end the game.");
        }
      } catch (err) {
        console.error("Error checking admin rights:", err);
        return ctx.reply(
          "⚠️ I couldn't verify admin rights.\n" +
          "👉 Please make sure I’m an admin in this group."
        );
      }
    }

    const currentGame = await db.query.gamesTable.findFirst({
      where: eq(gamesTable.activeChat, String(ctx.chat.id)),
    });

    if (!currentGame) return ctx.reply("There is no game in progress.");

    await db
      .delete(gamesTable)
      .where(eq(gamesTable.activeChat, String(ctx.chat.id)));

    const endResponse = `Game Ended!\nCorrect word was <strong>${
      currentGame.word
    }</strong>\nStart with /new\n${formatWordDetails(currentGame.word)}`;

    await ctx.reply(endResponse, { parse_mode: "HTML" });
  } catch (err) {
    console.error(err);
    return ctx.reply("Something went wrong. Please try again.");
  }
});

CommandsHelper.addNewCommand(
  "end",
  "End the current game. Available for only admins in groups.",
);

export const endGameCommand = composer;
