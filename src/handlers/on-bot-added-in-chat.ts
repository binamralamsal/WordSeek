import { Composer } from "grammy";

import { FOOTER_MESSAGE } from "../config/constants";
import { db } from "../config/db";

const composer = new Composer();

composer.on("my_chat_member", async (ctx) => {
  const { old_chat_member, new_chat_member, chat } = ctx.myChatMember;

  if (chat.type === "channel") {
    return;
  }

  if (
    old_chat_member.status === "left" &&
    new_chat_member.status === "member"
  ) {
    if (chat.type === "group" || chat.type === "supergroup") {
      return ctx.reply(
        `<blockquote>Hey! Thanks for adding me to the group. 😊</blockquote>
To function properly, I need to be able to read messages. Please make me an <strong>administrator</strong> with the least privileges possible—just enough to read messages.
If one of my versions <strong>(@WordSeekBot •|• @WordSeek2Bot)</strong> isn't working, feel free to remove it and add the other instead.
${FOOTER_MESSAGE}`,
        { parse_mode: "HTML" },
      );
    }
  }

  if (
    new_chat_member.status === "left" ||
    new_chat_member.status === "kicked"
  ) {
    await db
      .deleteFrom("broadcastChats")
      .where("id", "=", chat.id.toString())
      .execute();
    console.log(`Bot was removed/blocked from chat ${ctx.chat.id}`);
  }
});

export const onBotAddedInChat = composer;
