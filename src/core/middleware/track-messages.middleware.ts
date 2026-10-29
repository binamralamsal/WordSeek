import { Composer, Context } from "grammy";

import { env } from "#/config/env";
import { redis } from "#/config/redis";
import { createLogger } from "#/core/logging/logger.service";
import { redisKeys } from "#/core/redis-keys.constants";

const log = createLogger("core.middleware.track-messages.middleware");

const composer = new Composer();

const SUSPICIOUS_PATTERNS = {
  autoPlayer: /auto-player/i,
  swsCommand: /\/sws/i,
  ewsCommand: /\/ews/i,
  dotCommand: /^\.xx\b/i,
  wordhckCommand: /\/wordhck/i,
  autoWordplayCommand: /^\.autowordplay\b/i,
  stophckCommand: /\/stophck/i,
  wordonCommand: /\/wordon/i,
  wordoffCommand: /\/wordoff/i,
  benableCommand: /^\.benable\b/i,
  wordSeekCommand: /^\.word_seek\b/i,
  stopSeekCommand: /^\.stop_seek\b/i,
  helpWordseek: /^\.help\s+wordseek\b/i,
  autoSkCommand: /^\s*\.?auto[456]\s+sk\b/i,
  spCommand: /^\s*\.sp(?:\s|$)/i,
  speedSkCommand: /^\s*\.?speed\s+sk\b/i,
  apexUserbot: /apex/i,
  userbotWord: /userbot/i,
  newWordseekCommand: /\/new[456]?@wordseekbot/,
  endWordseekCommand: /\/end@wordseekbot/,
};

const isSuspiciousMessage = (text: string | undefined): boolean => {
  if (!text) return false;

  return (
    SUSPICIOUS_PATTERNS.autoPlayer.test(text) ||
    SUSPICIOUS_PATTERNS.swsCommand.test(text) ||
    SUSPICIOUS_PATTERNS.ewsCommand.test(text) ||
    SUSPICIOUS_PATTERNS.dotCommand.test(text) ||
    SUSPICIOUS_PATTERNS.autoWordplayCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordhckCommand.test(text) ||
    SUSPICIOUS_PATTERNS.stophckCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordonCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordoffCommand.test(text) ||
    SUSPICIOUS_PATTERNS.benableCommand.test(text) ||
    SUSPICIOUS_PATTERNS.wordSeekCommand.test(text) ||
    SUSPICIOUS_PATTERNS.stopSeekCommand.test(text) ||
    SUSPICIOUS_PATTERNS.helpWordseek.test(text) ||
    SUSPICIOUS_PATTERNS.autoSkCommand.test(text) ||
    SUSPICIOUS_PATTERNS.spCommand.test(text) ||
    SUSPICIOUS_PATTERNS.speedSkCommand.test(text) ||
    SUSPICIOUS_PATTERNS.newWordseekCommand.test(text) ||
    SUSPICIOUS_PATTERNS.endWordseekCommand.test(text) ||
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

type GreetingPhrase = "helloBaby" | "byee";

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

const greetingKey = (userId: number, phrase: GreetingPhrase) =>
  redisKeys.greetingTrack(userId, phrase, todayUtc());

const incrementDailyCounter = async (
  userId: number,
  phrase: GreetingPhrase,
): Promise<number> => {
  const key = greetingKey(userId, phrase);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 172800);
  }
  return count;
};

const getDailyCounter = async (
  userId: number,
  phrase: GreetingPhrase,
): Promise<number> => {
  const val = await redis.get(greetingKey(userId, phrase));
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
      log.error(
        { err, target },
        `Failed to send greeting combo alert to ${target}`,
      );
    }
  }
};

function detectSuspiciousReason(text: string): string | null {
  if (SUSPICIOUS_PATTERNS.swsCommand.test(text)) return "Contains /sws command";
  if (SUSPICIOUS_PATTERNS.ewsCommand.test(text)) return "Contains /ews command";
  if (SUSPICIOUS_PATTERNS.dotCommand.test(text))
    return "Dot command detected (e.g., .xx)";
  if (SUSPICIOUS_PATTERNS.autoWordplayCommand.test(text))
    return "Contains .autowordplay command";
  if (SUSPICIOUS_PATTERNS.autoPlayer.test(text))
    return "Auto-player keyword detected";
  if (SUSPICIOUS_PATTERNS.wordhckCommand.test(text))
    return "Contains /wordhck command";
  if (SUSPICIOUS_PATTERNS.stophckCommand.test(text))
    return "Contains /stophck command";
  if (SUSPICIOUS_PATTERNS.wordonCommand.test(text))
    return "Contains /wordon command";
  if (SUSPICIOUS_PATTERNS.wordoffCommand.test(text))
    return "Contains /wordoff command";
  if (SUSPICIOUS_PATTERNS.benableCommand.test(text))
    return "Contains .benable command";
  if (SUSPICIOUS_PATTERNS.wordSeekCommand.test(text))
    return "Contains .word_seek command";
  if (SUSPICIOUS_PATTERNS.stopSeekCommand.test(text))
    return "Contains .stop_seek command";
  if (SUSPICIOUS_PATTERNS.helpWordseek.test(text))
    return "Used .help wordseek command";
  if (SUSPICIOUS_PATTERNS.autoSkCommand.test(text))
    return "Contains auto4/5/6 sk command (auto-play start)";
  if (SUSPICIOUS_PATTERNS.spCommand.test(text))
    return "Contains .sp command (auto-play stop)";
  if (SUSPICIOUS_PATTERNS.speedSkCommand.test(text))
    return "Contains speed sk command (auto-play speed)";
  if (SUSPICIOUS_PATTERNS.newWordseekCommand.test(text))
    return "Contains /new@wordseekbot (or /new4, /new5, /new6) command";
  if (SUSPICIOUS_PATTERNS.endWordseekCommand.test(text))
    return "Contains /end@wordseekbot command";
  if (
    SUSPICIOUS_PATTERNS.apexUserbot.test(text) &&
    SUSPICIOUS_PATTERNS.userbotWord.test(text)
  ) {
    return 'Message contains both "apex" and "userbot"';
  }
  return null;
}

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

    const reason = detectSuspiciousReason(messageText);
    if (reason) {
      isSuspicious = true;
      suspiciousReason = reason;
    }

    try {
      await checkGreetingCombo(ctx, messageText);
    } catch (err) {
      log.error({ err: err }, "Greeting combo check error:");
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
      log.error({ err: err }, "Greeting combo check error (edited):");
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
            log.error({ err: e }, "Failed to forward message to logs channel:");
          }
        }
      } catch (error) {
        log.error({ err: error }, "Failed to send alert to logs channel:");
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
          log.error(
            { err: error, adminId },
            `Failed to alert admin ${adminId}`,
          );
        }
      }
    }
  }

  const adminChatId = await redis.get(redisKeys.tracking(chatId));

  if (adminChatId) {
    try {
      await forwardTrackedUpdate(ctx, chatId, Number(adminChatId));
    } catch (error) {
      log.error({ err: error }, "Tracking error:");
    }
  }

  await next();
});

async function forwardTrackedUpdate(
  ctx: Context,
  chatId: number,
  adminChatId: number,
) {
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
        await ctx.api.forwardMessage(adminChatId, chatId, msg.message_id);
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
          adminChatId,
          `🔔 New ${messageType} in chat ${chatId}\nFrom: ${from}\n\nMessage ID: ${msg.message_id}${msg.text ? `\n\n${msg.text}` : ""}`,
        );
      }
    }
  } else if (ctx.channelPost) {
    const post = ctx.channelPost;
    try {
      await ctx.api.forwardMessage(adminChatId, chatId, post.message_id);
    } catch (error) {
      await ctx.api.sendMessage(
        adminChatId,
        `🔔 New channel post in chat ${chatId}\nPost ID: ${post.message_id}`,
      );
    }
  } else if (ctx.editedMessage) {
    const edited = ctx.editedMessage;
    const from = edited.from
      ? `${edited.from.first_name}${edited.from.username ? ` (@${edited.from.username})` : ""}`
      : "Unknown";
    const text = edited.text || edited.caption || "[Media message]";

    await ctx.api.sendMessage(
      adminChatId,
      `✏️ Message edited in chat ${chatId}\nFrom: ${from}\nNew text: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`,
    );
  } else if (ctx.chatMember) {
    const update = ctx.chatMember;
    const user = update.new_chat_member.user;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;

    await ctx.api.sendMessage(
      adminChatId,
      `👥 Member status change in chat ${chatId}\nUser: ${user.first_name}${user.username ? ` (@${user.username})` : ""}\n${oldStatus} → ${newStatus}`,
    );
  } else if (ctx.myChatMember) {
    const update = ctx.myChatMember;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;

    await ctx.api.sendMessage(
      adminChatId,
      `🤖 Bot status change in chat ${chatId}\n${oldStatus} → ${newStatus}`,
    );
  } else if (ctx.callbackQuery) {
    const query = ctx.callbackQuery;
    const from = query.from;
    const data = query.data || "No data";

    await ctx.api.sendMessage(
      adminChatId,
      `🔘 Button clicked in chat ${chatId}\nFrom: ${from.first_name}${from.username ? ` (@${from.username})` : ""}\nData: ${data}`,
    );
  } else if (ctx.inlineQuery) {
    const query = ctx.inlineQuery;
    const from = query.from;

    await ctx.api.sendMessage(
      adminChatId,
      `🔍 Inline query in chat ${chatId}\nFrom: ${from.first_name}${from.username ? ` (@${from.username})` : ""}\nQuery: ${query.query}`,
    );
  }
}

export const trackMessagesMiddleware = composer;
