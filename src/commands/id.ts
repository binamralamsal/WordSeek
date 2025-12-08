import { Composer } from "grammy";

import { CommandsHelper } from "../util/commands-helper";

const composer = new Composer();

composer.command("id", async (ctx) => {
  const repliedMsg = ctx.message?.reply_to_message;

  if (!repliedMsg) {
    return ctx.reply("Please reply to a message to get its information.", {
      reply_to_message_id: ctx.message?.message_id,
    });
  }

  let info = "";

  info += "<b>▸ Message Information</b>\n";
  info += "<blockquote>";
  info += `<b>Message ID:</b> <code>${repliedMsg.message_id}</code>\n`;
  info += `<b>Date:</b> ${new Date(repliedMsg.date * 1000).toLocaleString()}`;
  info += "</blockquote>\n\n";

  if (repliedMsg.from) {
    info += "<b>▸ User Information</b>\n";
    info += "<blockquote>";
    info += `<b>User ID:</b> <code>${repliedMsg.from.id}</code>\n`;
    info += `<b>First Name:</b> ${repliedMsg.from.first_name}\n`;

    if (repliedMsg.from.last_name) {
      info += `<b>Last Name:</b> ${repliedMsg.from.last_name}\n`;
    }

    if (repliedMsg.from.username) {
      info += `<b>Username:</b> @${repliedMsg.from.username}\n`;
    }

    info += `<b>Is Bot:</b> ${repliedMsg.from.is_bot ? "Yes" : "No"}\n`;

    if (repliedMsg.from.language_code) {
      info += `<b>Language:</b> ${repliedMsg.from.language_code}\n`;
    }

    if (repliedMsg.from.is_premium) {
      info += `<b>Premium:</b> Yes\n`;
    }

    info = info.slice(0, -1);
    info += "</blockquote>\n\n";
  }

  info += "<b>▸ Chat Information</b>\n";
  info += "<blockquote>";
  info += `<b>Chat ID:</b> <code>${ctx.chat?.id}</code>\n`;
  info += `<b>Chat Type:</b> ${ctx.chat?.type}`;

  if (ctx.chat?.title) {
    info += `\n<b>Chat Title:</b> ${ctx.chat.title}`;
  }

  if (ctx.chat?.username) {
    info += `\n<b>Chat Username:</b> @${ctx.chat.username}`;
  }
  info += "</blockquote>\n\n";

  if (repliedMsg.forward_origin) {
    info += "<b>▸ Forward Information</b>\n";
    info += "<blockquote>";
    info += `<b>Forward Date:</b> ${new Date(repliedMsg.forward_origin.date * 1000).toLocaleString()}\n`;

    if (repliedMsg.forward_origin.type === "user") {
      info += `<b>Original Sender ID:</b> <code>${repliedMsg.forward_origin.sender_user.id}</code>\n`;
      info += `<b>Original Sender:</b> ${repliedMsg.forward_origin.sender_user.first_name}`;
      if (repliedMsg.forward_origin.sender_user.last_name) {
        info += ` ${repliedMsg.forward_origin.sender_user.last_name}`;
      }
      if (repliedMsg.forward_origin.sender_user.username) {
        info += `\n<b>Username:</b> @${repliedMsg.forward_origin.sender_user.username}`;
      }
    } else if (repliedMsg.forward_origin.type === "channel") {
      info += `<b>Original Chat ID:</b> <code>${repliedMsg.forward_origin.chat.id}</code>\n`;
      info += `<b>Original Chat:</b> ${repliedMsg.forward_origin.chat.title}`;
      if (repliedMsg.forward_origin.chat.username) {
        info += `\n<b>Channel Username:</b> @${repliedMsg.forward_origin.chat.username}`;
      }
      info += `\n<b>Original Message ID:</b> <code>${repliedMsg.forward_origin.message_id}</code>`;
    } else if (repliedMsg.forward_origin.type === "hidden_user") {
      info += `<b>Original Sender:</b> ${repliedMsg.forward_origin.sender_user_name} (Hidden)`;
    }

    info += "</blockquote>\n\n";
  }

  if (repliedMsg.photo) {
    info += "<b>▸ Photo</b>\n";
    info += "<blockquote>";
    const largestPhoto = repliedMsg.photo[repliedMsg.photo.length - 1];
    info += `<b>File ID:</b> <code>${largestPhoto.file_id}</code>\n`;
    info += `<b>File Unique ID:</b> <code>${largestPhoto.file_unique_id}</code>\n`;
    info += `<b>Dimensions:</b> ${largestPhoto.width}x${largestPhoto.height}`;
    if (largestPhoto.file_size) {
      info += `\n<b>File Size:</b> ${(largestPhoto.file_size / 1024).toFixed(2)} KB`;
    }
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.video) {
    info += "<b>▸ Video</b>\n";
    info += "<blockquote>";
    info += `<b>File ID:</b> <code>${repliedMsg.video.file_id}</code>\n`;
    info += `<b>File Unique ID:</b> <code>${repliedMsg.video.file_unique_id}</code>\n`;
    info += `<b>Dimensions:</b> ${repliedMsg.video.width}x${repliedMsg.video.height}\n`;
    info += `<b>Duration:</b> ${repliedMsg.video.duration}s`;
    if (repliedMsg.video.file_size) {
      info += `\n<b>File Size:</b> ${(repliedMsg.video.file_size / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (repliedMsg.video.mime_type) {
      info += `\n<b>MIME Type:</b> ${repliedMsg.video.mime_type}`;
    }
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.document) {
    info += "<b>▸ Document</b>\n";
    info += "<blockquote>";
    info += `<b>File ID:</b> <code>${repliedMsg.document.file_id}</code>\n`;
    info += `<b>File Unique ID:</b> <code>${repliedMsg.document.file_unique_id}</code>`;
    if (repliedMsg.document.file_name) {
      info += `\n<b>File Name:</b> ${repliedMsg.document.file_name}`;
    }
    if (repliedMsg.document.mime_type) {
      info += `\n<b>MIME Type:</b> ${repliedMsg.document.mime_type}`;
    }
    if (repliedMsg.document.file_size) {
      info += `\n<b>File Size:</b> ${(repliedMsg.document.file_size / (1024 * 1024)).toFixed(2)} MB`;
    }
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.audio) {
    info += "<b>▸ Audio</b>\n";
    info += "<blockquote>";
    info += `<b>File ID:</b> <code>${repliedMsg.audio.file_id}</code>\n`;
    info += `<b>File Unique ID:</b> <code>${repliedMsg.audio.file_unique_id}</code>\n`;
    info += `<b>Duration:</b> ${repliedMsg.audio.duration}s`;
    if (repliedMsg.audio.performer) {
      info += `\n<b>Performer:</b> ${repliedMsg.audio.performer}`;
    }
    if (repliedMsg.audio.title) {
      info += `\n<b>Title:</b> ${repliedMsg.audio.title}`;
    }
    if (repliedMsg.audio.mime_type) {
      info += `\n<b>MIME Type:</b> ${repliedMsg.audio.mime_type}`;
    }
    if (repliedMsg.audio.file_size) {
      info += `\n<b>File Size:</b> ${(repliedMsg.audio.file_size / (1024 * 1024)).toFixed(2)} MB`;
    }
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.voice) {
    info += "<b>▸ Voice</b>\n";
    info += "<blockquote>";
    info += `<b>File ID:</b> <code>${repliedMsg.voice.file_id}</code>\n`;
    info += `<b>File Unique ID:</b> <code>${repliedMsg.voice.file_unique_id}</code>\n`;
    info += `<b>Duration:</b> ${repliedMsg.voice.duration}s`;
    if (repliedMsg.voice.mime_type) {
      info += `\n<b>MIME Type:</b> ${repliedMsg.voice.mime_type}`;
    }
    if (repliedMsg.voice.file_size) {
      info += `\n<b>File Size:</b> ${(repliedMsg.voice.file_size / 1024).toFixed(2)} KB`;
    }
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.sticker) {
    info += "<b>▸ Sticker</b>\n";
    info += "<blockquote>";
    info += `<b>File ID:</b> <code>${repliedMsg.sticker.file_id}</code>\n`;
    info += `<b>File Unique ID:</b> <code>${repliedMsg.sticker.file_unique_id}</code>\n`;
    info += `<b>Dimensions:</b> ${repliedMsg.sticker.width}x${repliedMsg.sticker.height}\n`;
    info += `<b>Is Animated:</b> ${repliedMsg.sticker.is_animated ? "Yes" : "No"}\n`;
    info += `<b>Is Video:</b> ${repliedMsg.sticker.is_video ? "Yes" : "No"}`;
    if (repliedMsg.sticker.emoji) {
      info += `\n<b>Emoji:</b> ${repliedMsg.sticker.emoji}`;
    }
    if (repliedMsg.sticker.set_name) {
      info += `\n<b>Sticker Set:</b> ${repliedMsg.sticker.set_name}`;
    }
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.animation) {
    info += "<b>▸ Animation</b>\n";
    info += "<blockquote>";
    info += `<b>File ID:</b> <code>${repliedMsg.animation.file_id}</code>\n`;
    info += `<b>File Unique ID:</b> <code>${repliedMsg.animation.file_unique_id}</code>\n`;
    info += `<b>Dimensions:</b> ${repliedMsg.animation.width}x${repliedMsg.animation.height}\n`;
    info += `<b>Duration:</b> ${repliedMsg.animation.duration}s`;
    if (repliedMsg.animation.file_size) {
      info += `\n<b>File Size:</b> ${(repliedMsg.animation.file_size / (1024 * 1024)).toFixed(2)} MB`;
    }
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.text) {
    info += "<b>▸ Text Content</b>\n";
    info += "<blockquote>";
    info += `<b>Length:</b> ${repliedMsg.text.length} characters`;
    info += "</blockquote>\n\n";
  }

  if (repliedMsg.caption) {
    info += "<b>▸ Caption</b>\n";
    info += "<blockquote>";
    info += `<b>Length:</b> ${repliedMsg.caption.length} characters`;
    info += "</blockquote>\n\n";
  }

  await ctx.reply(info, {
    parse_mode: "HTML",
    reply_to_message_id: ctx.message?.message_id,
  });
});

CommandsHelper.addNewCommand(
  "id",
  "Get detailed information about a message (reply to a message)",
);

export const idCommand = composer;
