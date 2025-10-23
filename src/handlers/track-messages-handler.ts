import { Composer } from "grammy";

import { redis } from "../config/redis";

const composer = new Composer();

composer.use(async (ctx, next) => {
  const trackingKey = `tracking:${ctx.chat?.id}`;
  const adminChatId = await redis.get(trackingKey);

  if (adminChatId && ctx.chat) {
    try {
      if (ctx.message) {
        const msg = ctx.message;

        if (
          msg.text ||
          msg.photo ||
          msg.video ||
          msg.document ||
          msg.audio ||
          msg.voice ||
          msg.sticker ||
          msg.animation ||
          msg.video_note ||
          msg.poll ||
          msg.location ||
          msg.venue ||
          msg.contact
        ) {
          try {
            await ctx.api.forwardMessage(
              Number(adminChatId),
              ctx.chat.id,
              msg.message_id,
            );
          } catch (error) {
            const from = msg.from
              ? `${msg.from.first_name}${msg.from.username ? ` (@${msg.from.username})` : ""}`
              : "Unknown";
            let messageType = "message";

            if (msg.photo) messageType = "📷 Photo";
            else if (msg.video) messageType = "🎥 Video";
            else if (msg.document) messageType = "📄 Document";
            else if (msg.audio) messageType = "🎵 Audio";
            else if (msg.voice) messageType = "🎤 Voice";
            else if (msg.sticker) messageType = "🎭 Sticker";
            else if (msg.animation) messageType = "🎬 GIF";
            else if (msg.video_note) messageType = "📹 Video Note";
            else if (msg.poll) messageType = "📊 Poll";
            else if (msg.location) messageType = "📍 Location";
            else if (msg.venue) messageType = "🏢 Venue";
            else if (msg.contact) messageType = "👤 Contact";

            await ctx.api.sendMessage(
              Number(adminChatId),
              `🔔 New ${messageType} in chat ${ctx.chat.id}\nFrom: ${from}\n\nMessage ID: ${msg.message_id}`,
            );
          }
        }
      } else if (ctx.channelPost) {
        const post = ctx.channelPost;
        try {
          await ctx.api.forwardMessage(
            Number(adminChatId),
            ctx.chat.id,
            post.message_id,
          );
        } catch (error) {
          await ctx.api.sendMessage(
            Number(adminChatId),
            `🔔 New channel post in chat ${ctx.chat.id}\nPost ID: ${post.message_id}`,
          );
        }
      } else if (ctx.editedMessage) {
        const edited = ctx.editedMessage;
        const from = edited.from
          ? `${edited.from.first_name}${edited.from.username ? ` (@${edited.from.username})` : ""}`
          : "Unknown";
        const text = edited.text || edited.caption || "[Media message]";

        await ctx.api.sendMessage(
          Number(adminChatId),
          `✏️ Message edited in chat ${ctx.chat.id}\nFrom: ${from}\nNew text: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`,
        );
      } else if (ctx.chatMember) {
        const update = ctx.chatMember;
        const user = update.new_chat_member.user;
        const oldStatus = update.old_chat_member.status;
        const newStatus = update.new_chat_member.status;

        await ctx.api.sendMessage(
          Number(adminChatId),
          `👥 Member status change in chat ${ctx.chat.id}\nUser: ${user.first_name}${user.username ? ` (@${user.username})` : ""}\n${oldStatus} → ${newStatus}`,
        );
      } else if (ctx.myChatMember) {
        const update = ctx.myChatMember;
        const oldStatus = update.old_chat_member.status;
        const newStatus = update.new_chat_member.status;

        await ctx.api.sendMessage(
          Number(adminChatId),
          `🤖 Bot status change in chat ${ctx.chat.id}\n${oldStatus} → ${newStatus}`,
        );
      } else if (ctx.callbackQuery) {
        const query = ctx.callbackQuery;
        const from = query.from;
        const data = query.data || "No data";

        await ctx.api.sendMessage(
          Number(adminChatId),
          `🔘 Button clicked in chat ${ctx.chat.id}\nFrom: ${from.first_name}${from.username ? ` (@${from.username})` : ""}\nData: ${data}`,
        );
      } else if (ctx.inlineQuery) {
        const query = ctx.inlineQuery;
        const from = query.from;

        await ctx.api.sendMessage(
          Number(adminChatId),
          `🔍 Inline query in chat ${ctx.chat.id}\nFrom: ${from.first_name}${from.username ? ` (@${from.username})` : ""}\nQuery: ${query.query}`,
        );
      }
    } catch (error) {
      console.error("Tracking error:", error);
    }
  }

  await next();
});

export const trackMessagesHandler = composer;
