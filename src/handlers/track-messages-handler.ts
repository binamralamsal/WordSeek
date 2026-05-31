import { Composer, Context } from "grammy";

import { env } from "../config/env";
import { redis } from "../config/redis";

const composer = new Composer();

const SUSPICIOUS_PATTERNS = {
  autoPlayer: /auto-player/i,
  swsCommand: /\/sws/i,
  ewsCommand: /\/ews/i,
  dotCommand: /^\.xx\b/i,
  wordhckCommand: /\/wordhck/i,
  stophckCommand: /\/stophck/i,
  wordonCommand: /\/wordon/i,
  wordoffCommand: /\/wordoff/i,
  benableCommand: /^\.benable\b/i,
  wordSeekCommand: /^\.word_seek\b/i,
  stopSeekCommand: /^\.stop_seek\b/i,
  wordseekSlashCommand: /^\/wordseek\b.*$/i,
  helpWordseek: /^\.help\s+wordseek\b/i,
  apexUserbot: /apex/i,
  userbotWord: /userbot/i,
};

const isSuspiciousMessage = (text: string | undefined): boolean => {
  if (!text) return false;

  return (
    SUSPICIOUS_PATTERNS.autoPlayer.test(text) ||
    SUSPICIOUS_PATTERNS.swsCommand.test(text) ||
    SUSPICIOUS_PATTERNS.ewsCommand.test(text) ||
    SUSPICIOUS_PATTERNS.dotCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordhckCommand.test(text) ||
    SUSPICIOUS_PATTERNS.stophckCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordonCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordoffCommand.test(text) ||
    SUSPICIOUS_PATTERNS.benableCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordSeekCommand.test(text) ||
    SUSPICIOUS_PATTERNS.stopSeekCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordseekSlashCommand.test(text) ||
    SUSPICIOUS_PATTERNS.helpWordseek.test(text) ||
    (SUSPICIOUS_PATTERNS.apexUserbot.test(text) &&
      SUSPICIOUS_PATTERNS.userbotWord.test(text))
  );
};

const sendSuspiciousAlert = async (
  ctx: Context,
  adminChatId: number,
  reason: string,
  messageText?: string,
) => {
  const from = ctx.from || ctx.message?.from || ctx.editedMessage?.from;
  const chat = ctx.chat;

  if (!from || !chat) return;

  const userName =
    from.first_name + (from.last_name ? ` ${from.last_name}` : "");
  const username = from.username ? `@${from.username}` : "No username";
  const userId = from.id;
  const chatId = chat.id;
  const chatTitle = chat.title || chat.first_name || "Unknown";

  let alertMessage = `🚨 SUSPICIOUS ACTIVITY DETECTED\n\n`;
  alertMessage += `Reason: ${reason}\n\n`;
  alertMessage += `👤 User Info:\n`;
  alertMessage += `├ Name: ${userName}\n`;
  alertMessage += `├ Username: ${username}\n`;
  alertMessage += `└ User ID: ${userId}\n\n`;
  alertMessage += `💬 Chat Info:\n`;
  alertMessage += `├ Title: ${chatTitle}\n`;
  alertMessage += `└ Chat ID: ${chatId}\n`;

  if (messageText) {
    alertMessage += `\n📝 Message:\n${messageText.substring(0, 500)}${messageText.length > 500 ? "..." : ""}`;
  }

  await ctx.api.sendMessage(adminChatId, alertMessage);
};

const HELLO_BABY_PATTERN = /hello\s+baby/i;
const BYEE_PATTERN = /byee/i;

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

const incrementDailyCounter = async (
  userId: number,
  phrase: "helloBaby" | "byee",
): Promise<number> => {
  const key = `greetingTrack:${userId}:${phrase}:${todayUtc()}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 172800);
  }
  return count;
};

const getDailyCounter = async (
  userId: number,
  phrase: "helloBaby" | "byee",
): Promise<number> => {
  const key = `greetingTrack:${userId}:${phrase}:${todayUtc()}`;
  const val = await redis.get(key);
  return val ? parseInt(val, 10) : 0;
};

const checkGreetingCombo = async (ctx: Context, text: string) => {
  const from = ctx.from || ctx.message?.from;
  if (!from) return;

  const userId = from.id;
  const hasHelloBaby = HELLO_BABY_PATTERN.test(text);
  const hasByee = BYEE_PATTERN.test(text);

  if (!hasHelloBaby && !hasByee) return;

  if (hasHelloBaby) await incrementDailyCounter(userId, "helloBaby");
  if (hasByee) await incrementDailyCounter(userId, "byee");

  const helloBabyCount = await getDailyCounter(userId, "helloBaby");
  const byeeCount = await getDailyCounter(userId, "byee");

  if (helloBabyCount === 0 || byeeCount === 0) return;

  const userName =
    from.first_name + (from.last_name ? ` ${from.last_name}` : "");
  const username = from.username ? `@${from.username}` : "No username";
  const chat = ctx.chat;
  const chatTitle = chat
    ? chat.title || chat.first_name || "Unknown"
    : "Unknown";

  const alertMessage =
    `👋 GREETING COMBO DETECTED\n\n` +
    `User has used both "Hello Baby" and "Byee" today.\n\n` +
    `👤 User Info:\n` +
    `├ Name: ${userName}\n` +
    `├ Username: ${username}\n` +
    `└ User ID: ${userId}\n\n` +
    `💬 Chat Info:\n` +
    `├ Title: ${chatTitle}\n` +
    `└ Chat ID: ${chat?.id ?? "Unknown"}\n\n` +
    `📊 Today's counts:\n` +
    `├ "Hello Baby": ${helloBabyCount}x\n` +
    `└ "Byee": ${byeeCount}x`;

  const targets: number[] = env.LOGS_CHANNEL
    ? [env.LOGS_CHANNEL]
    : env.ADMIN_USERS;

  for (const target of targets) {
    try {
      await ctx.api.sendMessage(target, alertMessage);
    } catch (err) {
      console.error(`Failed to send greeting combo alert to ${target}:`, err);
    }
  }
};

composer.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await next();
    return;
  }

  let isSuspicious = false;
  let suspiciousReason = "";
  let messageText = "";

  if (ctx.message?.text || ctx.message?.caption) {
    messageText = ctx.message.text || ctx.message.caption || "";

    if (SUSPICIOUS_PATTERNS.swsCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains /sws command";
    } else if (SUSPICIOUS_PATTERNS.ewsCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains /ews command";
    } else if (SUSPICIOUS_PATTERNS.dotCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Dot command detected (e.g., .xx)";
    } else if (SUSPICIOUS_PATTERNS.autoPlayer.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Auto-player keyword detected";
    } else if (SUSPICIOUS_PATTERNS.wordhckCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains /wordhck command";
    } else if (SUSPICIOUS_PATTERNS.stophckCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains /stophck command";
    } else if (SUSPICIOUS_PATTERNS.wordonCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains /wordon command";
    } else if (SUSPICIOUS_PATTERNS.wordoffCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains /wordoff command";
    } else if (SUSPICIOUS_PATTERNS.benableCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains .benable command";
    } else if (SUSPICIOUS_PATTERNS.wordSeekCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains .word_seek command";
    } else if (SUSPICIOUS_PATTERNS.stopSeekCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains .stop_seek command";
    } else if (SUSPICIOUS_PATTERNS.wordseekSlashCommand.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Contains /wordseek command";
    } else if (SUSPICIOUS_PATTERNS.helpWordseek.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Used .help wordseek command";
    } else if (
      SUSPICIOUS_PATTERNS.apexUserbot.test(messageText) &&
      SUSPICIOUS_PATTERNS.userbotWord.test(messageText)
    ) {
      isSuspicious = true;
      suspiciousReason = 'Message contains both "apex" and "userbot"';
    }

    try {
      await checkGreetingCombo(ctx, messageText);
    } catch (err) {
      console.error("Greeting combo check error:", err);
    }
  }

  if (ctx.editedMessage?.text || ctx.editedMessage?.caption) {
    messageText = ctx.editedMessage.text || ctx.editedMessage.caption || "";

    if (SUSPICIOUS_PATTERNS.autoPlayer.test(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Edited message contains auto-player keyword";
    } else if (
      SUSPICIOUS_PATTERNS.apexUserbot.test(messageText) &&
      SUSPICIOUS_PATTERNS.userbotWord.test(messageText)
    ) {
      isSuspicious = true;
      suspiciousReason = 'Edited message contains both "apex" and "userbot"';
    } else if (isSuspiciousMessage(messageText)) {
      isSuspicious = true;
      suspiciousReason = "Edited message contains suspicious pattern";
    }

    try {
      await checkGreetingCombo(ctx, messageText);
    } catch (err) {
      console.error("Greeting combo check error (edited):", err);
    }
  }

  if (isSuspicious) {
    if (env.LOGS_CHANNEL) {
      try {
        await sendSuspiciousAlert(
          ctx,
          env.LOGS_CHANNEL,
          suspiciousReason,
          messageText,
        );

        if (ctx.message?.message_id) {
          try {
            await ctx.api.forwardMessage(
              env.LOGS_CHANNEL,
              chatId,
              ctx.message.message_id,
            );
          } catch (e) {
            console.error("Failed to forward message to logs channel:", e);
          }
        }
      } catch (error) {
        console.error("Failed to send alert to logs channel:", error);
      }
    } else {
      for (const adminId of env.ADMIN_USERS) {
        try {
          await sendSuspiciousAlert(
            ctx,
            adminId,
            suspiciousReason,
            messageText,
          );

          if (ctx.message?.message_id) {
            try {
              await ctx.api.forwardMessage(
                adminId,
                chatId,
                ctx.message.message_id,
              );
            } catch (e) {}
          }
        } catch (error) {
          console.error(`Failed to alert admin ${adminId}:`, error);
        }
      }
    }
  }

  const trackingKey = `tracking:${ctx.chat?.id}`;
  const adminChatId = await redis.get(trackingKey);

  if (adminChatId) {
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
              `🔔 New ${messageType} in chat ${ctx.chat.id}\nFrom: ${from}\n\nMessage ID: ${msg.message_id}${msg.text ? `\n\n${msg.text}` : ""}`,
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
